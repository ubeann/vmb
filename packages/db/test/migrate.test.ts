import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SqlClient } from "../src/sql-client.js";
import { applyMigrations } from "../src/migration/apply.js";
import { createDatabase, migrationsFolder, truncatedChain } from "./harness.js";

type JournalRow = { hash: string; created_at: string };
type Journal = { entries: { tag: string; when: number }[] };

/** The journal as a deployment would read it: insertion order. */
async function journal(client: SqlClient): Promise<JournalRow[]> {
  return client.query<JournalRow>(
    "select hash, created_at from drizzle.__drizzle_migrations order by id"
  );
}

/** The chain's tags, from the file drizzle-kit reads — not from the module under test. */
async function chain(folder = migrationsFolder): Promise<Journal> {
  return JSON.parse(await readFile(path.join(folder, "meta", "_journal.json"), "utf8")) as Journal;
}

/**
 * The objects the chain creates — tables, columns, sequences, indexes and
 * constraints, each named with its schema — as one ordered fingerprint. Two
 * databases that differ by a table in the wrong schema, a missing sequence, a
 * column type or a constraint say so here; aggregate counts cannot.
 */
async function shape(client: SqlClient): Promise<string[]> {
  // `pg_get_constraintdef` qualifies a table name only when its schema is off
  // the search path, so the fingerprint compares the schema, not how the
  // session that built it left its path.
  await client.exec("set search_path = public");
  const rows = await client.query<{ name: string }>(
    `select 'table ' || table_schema || '.' || table_name as name
       from information_schema.tables
       where table_schema not in ('pg_catalog', 'information_schema')
     union all
     select 'column ' || table_schema || '.' || table_name || '.' || column_name
         || ' ' || data_type || ' nullable=' || is_nullable
         || ' default=' || coalesce(column_default, '-')
       from information_schema.columns
       where table_schema not in ('pg_catalog', 'information_schema')
     union all
     select 'sequence ' || n.nspname || '.' || c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where c.relkind = 'S' and n.nspname not in ('pg_catalog', 'information_schema')
     union all
     select 'index ' || schemaname || '.' || indexname || ' = ' || indexdef
       from pg_indexes
       where schemaname not in ('pg_catalog', 'information_schema')
     union all
     select 'constraint ' || n.nspname || '.' || c.conname || ' = ' || pg_get_constraintdef(c.oid)
       from pg_constraint c
       join pg_namespace n on n.oid = c.connamespace
       where n.nspname not in ('pg_catalog', 'information_schema')
     order by 1`
  );
  return rows.map((row) => row.name);
}

describe("applyMigrations", () => {
  it("journals a fresh chain exactly as Drizzle's migrator does", async () => {
    const ours = await createDatabase();
    const oracle = await createDatabase();
    try {
      const results = await applyMigrations(ours.client, migrationsFolder);
      await oracle.migrate();

      const { entries } = await chain();
      expect(results.map((migration) => migration.tag)).toEqual(entries.map((entry) => entry.tag));
      expect(results.every((migration) => migration.applied)).toBe(true);
      expect(results.every((migration) => migration.milliseconds >= 0)).toBe(true);

      expect(await journal(ours.client)).toEqual(await journal(oracle.client));
      expect(await shape(ours.client)).toEqual(await shape(oracle.client));
    } finally {
      await ours.close();
      await oracle.close();
    }
  });

  it("applies nothing when the journal is already current", async () => {
    const database = await createDatabase();
    try {
      await applyMigrations(database.client, migrationsFolder);
      const before = await journal(database.client);

      const results = await applyMigrations(database.client, migrationsFolder);

      expect(results.every((migration) => !migration.applied)).toBe(true);
      expect(results.every((migration) => migration.milliseconds === 0)).toBe(true);
      expect(await journal(database.client)).toEqual(before);
    } finally {
      await database.close();
    }
  });

  it("pays one round trip per pending migration, not one per statement", async () => {
    const database = await createDatabase();
    try {
      const executions: string[] = [];
      const counted: SqlClient = {
        exec: async (sql) => {
          executions.push(sql);
          await database.client.exec(sql);
        },
        query: async <T>(sql: string) => database.client.query<T>(sql)
      };

      const results = await applyMigrations(counted, migrationsFolder);

      const { entries } = await chain();
      expect(results.filter((migration) => migration.applied)).toHaveLength(entries.length);
      // one exec for the journal DDL, then exactly one per migration — not one
      // per statement, of which the chain carries hundreds
      expect(executions).toHaveLength(entries.length + 1);
    } finally {
      await database.close();
    }
  });

  it("resumes from a journal that stopped part-way", async () => {
    const stopped = 5;
    const partial = await truncatedChain(stopped);
    const ours = await createDatabase();
    const oracle = await createDatabase();
    try {
      // the oracle builds the partial state, so the module under test is not
      // the thing that decided what "part-way" means
      await ours.migrate(partial);
      expect(await journal(ours.client)).toHaveLength(stopped);

      const results = await applyMigrations(ours.client, migrationsFolder);
      await oracle.migrate();

      const { entries } = await chain();
      expect(results.filter((m) => m.applied).map((m) => m.tag)).toEqual(
        entries.slice(stopped).map((entry) => entry.tag)
      );
      expect(await journal(ours.client)).toEqual(await journal(oracle.client));
      expect(await shape(ours.client)).toEqual(await shape(oracle.client));
    } finally {
      await ours.close();
      await oracle.close();
      await rm(partial, { recursive: true, force: true });
    }
  });
});
