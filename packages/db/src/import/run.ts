import type { PGlite } from "@electric-sql/pglite";
import { loadStatements } from "./load.js";
import { portedTables } from "./manifest.js";
import { byPhase, readChain, type Migration } from "./phases.js";
import { readSnapshot } from "./snapshot.js";
import { failedReport, isClean, verify, type Report } from "./verify.js";

/**
 * Load a legacy snapshot into an empty database and replay the chain over it.
 *
 * The baseline runs first, the rows go in next, and every later migration runs
 * over those rows — the order ADR-0024 describes. The migration journal is
 * written as each migration completes, so a database this pipeline produces is
 * indistinguishable from one the migrator built.
 *
 * Wipe-and-reload: the database is expected to be empty, and re-running the
 * whole pipeline against a fresh database is the refresh path.
 */
export async function importSnapshot(
  client: PGlite,
  snapshotFile: string,
  migrationsFolder: string
): Promise<Report> {
  const snapshot = await readSnapshot(snapshotFile);
  const migrations = await readChain(migrationsFolder);
  const { statements, problems } = loadStatements(snapshot);

  try {
    await apply(client, byPhase(migrations, "baseline"));

    if (statements.length > 0) {
      await client.exec(statements.join("\n"));
    }

    await apply(client, byPhase(migrations, "after"));
  } catch (error) {
    return failedReport(error instanceof Error ? error.message : String(error));
  }

  const report = await verify(snapshot, verifierFor(client, snapshot));
  report.errors.push(...problems);
  return report;
}

/** Run a phase in order, journaling each migration as its statements complete. */
async function apply(client: PGlite, phase: Migration[]): Promise<void> {
  for (const migration of phase) {
    for (const statement of migration.statements) {
      await client.exec(statement);
    }
    await recordMigration(client, migration);
  }
}

async function recordMigration(client: PGlite, migration: Migration): Promise<void> {
  await client.exec("create schema if not exists drizzle");
  await client.exec(
    `create table if not exists drizzle.__drizzle_migrations (
       id serial primary key,
       hash text not null,
       created_at bigint
     )`
  );
  const hash = migration.hash.replace(/'/g, "''");
  await client.exec(
    `insert into drizzle.__drizzle_migrations ("hash", "created_at")
     values ('${hash}', ${migration.folderMillis})`
  );
}

function verifierFor(client: PGlite, snapshot: SnapshotShape) {
  return {
    sourceRows: (table: string) => snapshot.rows.get(table)?.length ?? 0,
    targetRows: async (table: string) => {
      const result = await client.query<{ value: number }>(
        `select count(*)::int as value from ${quoted(table)}`
      );
      return result.rows[0]?.value ?? 0;
    },
    checksum: async (table: string) => {
      const result = await client.query<{ value: string | null }>(
        `select md5(string_agg(t::text, '|' order by t::text)) as value
           from ${quoted(table)} t`
      );
      return result.rows[0]?.value ?? null;
    },
    danglingForeignKeys: async () => {
      const result = await client.query<{ value: number }>(
        `select count(*)::int as value from pg_constraint c
          where c.contype = 'f'
            and not exists (select 1 from pg_class t where t.oid = c.confrelid)`
      );
      return result.rows[0]?.value ?? 0;
    }
  };
}

type SnapshotShape = Awaited<ReturnType<typeof readSnapshot>>;

function quoted(table: string): string {
  return table
    .split(".")
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(".");
}

/** The tables the pipeline is expected to have carried, for reporting. */
export function carriedTables(): string[] {
  return [...portedTables];
}

export function summarise(report: Report): string {
  const lines = [
    `rows: ${Object.values(report.rowCounts).reduce((a, b) => a + b, 0)} across ${Object.keys(report.rowCounts).length} tables`,
    `checksums: ${Object.keys(report.checksums).length}`,
    `errors: ${report.errors.length}`,
    `warnings: ${report.warnings.length}`
  ];
  for (const finding of [...report.errors, ...report.warnings]) {
    lines.push(`  [${finding.level}] ${finding.code}: ${finding.message}`);
  }
  return lines.join("\n");
}

export function clean(report: Report): boolean {
  return isClean(report);
}
