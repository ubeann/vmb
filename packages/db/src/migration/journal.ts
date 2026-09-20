import type { Migration } from "./chain.js";

/**
 * The journal Drizzle's migrator reads, created the way it creates it.
 *
 * One schema and one table, with the columns the journal's `hash` and
 * `created_at` live in. Every writer of `drizzle.__drizzle_migrations` — the
 * migrator and the import pipeline — uses these, so the two cannot disagree
 * about the shape they write into.
 */
export const journalDdl = `create schema if not exists "drizzle";
create table if not exists "drizzle"."__drizzle_migrations" (
  id serial primary key,
  hash text not null,
  created_at bigint
);`;

/** The row one migration leaves: its file's sha256, ordered by the journal's `when`. */
export function journalInsertSql(migration: Migration): string {
  const hash = migration.hash.replace(/'/g, "''");
  return `insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ('${hash}', ${migration.folderMillis});`;
}
