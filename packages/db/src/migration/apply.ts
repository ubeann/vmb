import type { SqlClient } from "../import/client.js";
import { readMigrations, type Migration } from "./chain.js";

/** What one migration in the chain did, and how long it took. */
export type AppliedMigration = {
  tag: string;
  /** false when the journal already had it. */
  applied: boolean;
  milliseconds: number;
};

/**
 * Replay the chain, in one round trip per migration.
 *
 * The statements, the journal row, and the transaction that wraps them travel
 * as a single `exec`, so a chain that costs hundreds of statements costs one
 * round trip per file instead of one per statement. The journal rows are the
 * ones Drizzle's own migrator writes — `hash` is sha256 of the file and
 * `created_at` is the journal's `when` — so a database this built is one
 * `drizzle-kit migrate` agrees is current.
 */
export async function applyMigrations(
  client: SqlClient,
  migrationsFolder: string
): Promise<AppliedMigration[]> {
  const migrations = await readMigrations(migrationsFolder);
  await createJournal(client);

  const [last] = await client.query<{ created_at: string | number }>(
    `select "created_at" from "drizzle"."__drizzle_migrations" order by "created_at" desc limit 1`
  );
  const appliedThrough = last ? Number(last.created_at) : Number.NEGATIVE_INFINITY;

  const results: AppliedMigration[] = [];
  for (const migration of migrations) {
    if (appliedThrough >= migration.folderMillis) {
      results.push({ tag: migration.tag, applied: false, milliseconds: 0 });
      continue;
    }

    const started = performance.now();
    await client.exec(oneRoundTrip(migration));
    results.push({
      tag: migration.tag,
      applied: true,
      milliseconds: Math.round(performance.now() - started)
    });
  }
  return results;
}

/** The journal Drizzle creates before it reads it, in one round trip. */
async function createJournal(client: SqlClient): Promise<void> {
  await client.exec(
    `create schema if not exists "drizzle";
     create table if not exists "drizzle"."__drizzle_migrations" (
       id serial primary key,
       hash text not null,
       created_at bigint
     );`
  );
}

/**
 * One migration as one statement: its transaction, its journal row, and the
 * restore of `search_path` the baseline's dump preamble clears.
 */
function oneRoundTrip(migration: Migration): string {
  const hash = migration.hash.replace(/'/g, "''");
  return [
    "begin;",
    "set search_path = public;",
    ...migration.statements,
    `insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ('${hash}', ${migration.folderMillis});`,
    "commit;"
  ].join("\n");
}
