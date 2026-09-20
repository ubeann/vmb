import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SqlClient } from "../src/import/client.js";
import { applyMigrations } from "../src/migration/apply.js";
import { createDatabase, migrationsFolder } from "./harness.js";

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

/** The objects the chain creates, as a comparable fingerprint. */
async function shape(client: SqlClient): Promise<Record<string, number>> {
  const rows = await client.query<Record<string, number>>(
    `select
       (select count(*)::int from information_schema.tables
         where table_schema not in ('pg_catalog', 'information_schema')) as tables,
       (select count(*)::int from pg_indexes
         where schemaname not in ('pg_catalog', 'information_schema')) as indexes,
       (select count(*)::int from pg_constraint
         where connamespace in (select oid from pg_namespace
           where nspname not in ('pg_catalog', 'information_schema'))) as constraints`
  );
  const row = rows[0];
  if (!row) {
    throw new Error("the fingerprint query returned no row");
  }
  return row;
}

/** The first `count` migrations only, as an earlier run that stopped part-way saw them. */
async function truncatedChain(count: number): Promise<string> {
  const folder = await mkdtemp(path.join(tmpdir(), "vmb-chain-"));
  const { entries } = await chain();
  const first = entries.slice(0, count);

  await mkdir(path.join(folder, "meta"), { recursive: true });
  await writeFile(path.join(folder, "meta", "_journal.json"), JSON.stringify({ entries: first }));
  for (const entry of first) {
    await copyFile(`${migrationsFolder}/${entry.tag}.sql`, `${folder}/${entry.tag}.sql`);
  }
  return folder;
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
