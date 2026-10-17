import type { SqlClient } from "../sql-client.js";
import { transformIdentities, type IdentityTransformResult } from "./identity.js";
import { loadStatements } from "./load.js";
import { transformRbac, type RbacReport } from "./rbac.js";
import { journalDdl, journalInsertSql } from "../migration/journal.js";
import { byPhase, readChain, type Migration } from "./phases.js";
import { readSnapshot } from "./snapshot.js";
import { failedReport, verify, type Finding, type Report } from "./verify.js";

/**
 * Load a legacy snapshot and replay the chain over it.
 *
 * The baseline runs first, the rows go in next, and every later migration runs
 * over those rows — the order ADR-0024 describes. Each phase is one transaction
 * and each migration is journaled as it completes, so a database this pipeline
 * produces is indistinguishable from one the migrator built and a later
 * `db:migrate` applies only what is missing.
 *
 * The target is wiped first, so running the pipeline twice against the same
 * database lands in the same place. That makes the pipeline the owner of the
 * database it is pointed at — see `docs/migration/import-pipeline.md`.
 */
export async function importSnapshot(
  client: SqlClient,
  snapshotFile: string,
  migrationsFolder: string
): Promise<Report> {
  const snapshot = await readSnapshot(snapshotFile);
  const migrations = await readChain(migrationsFolder);
  const { statements, problems } = loadStatements(snapshot);
  let identities: IdentityTransformResult | undefined;
  let rbac: { report: RbacReport; findings: Finding[] } | undefined;

  try {
    await reset(client);
    await apply(client, byPhase(migrations, "baseline"));

    if (statements.length > 0) {
      await client.exec("begin");
      try {
        await client.exec(statements.join("\n"));
        await client.exec("commit");
      } catch (error) {
        await client.exec("rollback");
        throw error;
      }
    }

    await apply(client, byPhase(migrations, "after"));

    // Identity is the one ETL path (#7, ADR-0032/0033): it reads the replayed
    // business rows the chain left behind and writes Better Auth identities.
    identities = await transformIdentities(client);

    // RBAC reads the snapshot, not the database: the legacy role tables are
    // never loaded and 0030 has dropped users.division_id (#311, ADR-0056).
    rbac = await transformRbac(client, snapshot);
  } catch (error) {
    return failedReport(error instanceof Error ? error.message : String(error));
  }

  const report = await verify(snapshot, client);
  report.errors.push(...problems);
  for (const finding of rbac.findings) {
    (finding.level === "error" ? report.errors : report.warnings).push(finding);
  }
  report.identities = identities;
  report.rbac = rbac.report;
  return report;
}

/**
 * Return the target to an empty database.
 *
 * The four legacy schemas, the journal, and the auth tables migrations 0000
 * and 0027 create — and nothing else. Anything the pipeline did not create is
 * left alone, so pointing it at a database with other data will not delete it.
 */
async function reset(client: SqlClient): Promise<void> {
  for (const schema of ["master", "warehouse", "trucking", "expense", "drizzle"]) {
    await client.exec(`drop schema if exists ${schema} cascade`);
  }
  await client.exec(
    `drop table if exists public."user", public."session", public."account", public."verification",
       public."rate_limit" cascade`
  );
}

/** Run a phase in order, journaling each migration as its statements complete. */
async function apply(client: SqlClient, phase: Migration[]): Promise<void> {
  if (phase.length === 0) return;

  await client.exec("begin");
  try {
    for (const migration of phase) {
      // the baseline's dump preamble clears search_path, so restore it before
      // each migration rather than inheriting whatever the last one left
      await client.exec("set search_path = public");
      for (const statement of migration.statements) {
        await client.exec(statement);
      }
      await client.exec(journalDdl);
      await client.exec(journalInsertSql(migration));
    }
    await client.exec("commit");
  } catch (error) {
    await client.exec("rollback");
    throw error;
  }
}

export function summarise(report: Report): string {
  const lines = [
    `rows: ${Object.values(report.rowCounts).reduce((a, b) => a + b, 0)} across ${Object.keys(report.rowCounts).length} tables`,
    `checksums: ${Object.keys(report.checksums).length}`,
    `errors: ${report.errors.length}`,
    `warnings: ${report.warnings.length}`
  ];
  if (report.identities) {
    lines.push(`identities: ${report.identities.users} user(s) created`);
  }
  if (report.rbac) {
    const { rolesCarried, rolesSplit, grants, assignments, unmappedPermissions } = report.rbac;
    lines.push(
      `rbac: ${rolesCarried} role(s) carried (${rolesSplit} split), ${grants} grant(s), ${assignments} assignment(s), ${unmappedPermissions} unmapped permission(s)`
    );
  }
  for (const finding of [...report.errors, ...report.warnings]) {
    lines.push(`  [${finding.level}] ${finding.code}: ${finding.message}`);
  }
  return lines.join("\n");
}
