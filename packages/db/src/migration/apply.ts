import type { SqlClient } from "../import/client.js";
import { readMigrations, type Migration } from "./chain.js";
import { journalDdl, journalInsertSql } from "./journal.js";

/** What one migration in the chain did, and how long it took. */
export type AppliedMigration = {
  tag: string;
  /** false when the journal already had it. */
  applied: boolean;
  milliseconds: number;
};

/**
 * Replay the chain, one round trip per migration.
 *
 * Each migration's statements, the transaction that wraps them and its journal
 * row travel as a single `exec`, so a chain of hundreds of statements costs one
 * round trip per file instead of one per statement. The journal rows are the
 * ones Drizzle's own migrator writes — `hash` is sha256 of the file and
 * `created_at` is the journal's `when` — so a database this built is one
 * `drizzle-kit migrate` agrees is current. Each migration is its own
 * transaction, so a chain that dies part-way resumes from the file after the
 * last journaled one.
 *
 * `onMigration` observes each decision as it is made, not after the whole
 * chain: a caller that reports progress can name the migration that failed.
 */
export async function applyMigrations(
  client: SqlClient,
  migrationsFolder: string,
  onMigration?: (migration: AppliedMigration) => void
): Promise<AppliedMigration[]> {
  const migrations = await readMigrations(migrationsFolder);
  await client.exec(journalDdl);

  const [last] = await client.query<{ created_at: string | number }>(
    `select "created_at" from "drizzle"."__drizzle_migrations" order by "created_at" desc limit 1`
  );
  const appliedThrough = last ? Number(last.created_at) : Number.NEGATIVE_INFINITY;

  const results: AppliedMigration[] = [];
  for (const migration of migrations) {
    if (appliedThrough >= migration.folderMillis) {
      const result = { tag: migration.tag, applied: false, milliseconds: 0 };
      results.push(result);
      onMigration?.(result);
      continue;
    }

    const started = performance.now();
    await client.exec(migrationScript(migration));
    const result = {
      tag: migration.tag,
      applied: true,
      milliseconds: Math.round(performance.now() - started)
    };
    results.push(result);
    onMigration?.(result);
  }
  return results;
}

/**
 * One migration as one script: its transaction, its statements and its journal
 * row, executed without returning to the client in between. `search_path` is
 * restored first because the baseline's dump preamble clears it, the same
 * reset the import pipeline performs before each migration.
 */
function migrationScript(migration: Migration): string {
  return [
    "begin;",
    "set search_path = public;",
    ...migration.statements,
    journalInsertSql(migration),
    "commit;"
  ].join("\n");
}
