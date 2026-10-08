import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleEmbedded } from "drizzle-orm/pglite";
import { migrate as migrateEmbedded } from "drizzle-orm/pglite/migrator";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import type { MasterDb } from "../src/master/db.js";
import { migrationsFolder } from "../src/migrations-path.js";
import { schema } from "../src/schema/index.js";
import { pgClient, pgliteClient, type SqlClient } from "../src/sql-client.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

/** The real Drizzle Kit migration chain — never a fixture of it. */
export { migrationsFolder };

/**
 * A database the tests can use, and the two things they need from a backend:
 * the client the pipeline speaks to, and drizzle's own migrator.
 *
 * Embedded Postgres keeps the default run service-free and secret-free. Set
 * `TEST_DATABASE_URL` to run the same suite against a real Postgres, which is
 * what the CI job does — the two disagreeing is exactly what it exists to catch.
 */
export type TestDatabase = {
  client: SqlClient;
  /** The same database through Drizzle, for the stores built on it. */
  db: MasterDb;
  /**
   * Every statement `db` has sent, in order, so a test can fix how many round
   * trips a use case costs (ADR-0045's amendment). `client` is not logged: a
   * test's own setup through it does not count.
   */
  statements: string[];
  /**
   * Replay the chain with drizzle's own migrator — the independent oracle the
   * migration module is checked against, not what a deployment runs
   * (`packages/db/src/migration/apply.ts` is).
   *
   * Pass a folder to replay a truncated chain — the state an earlier run left
   * behind when it stopped part-way.
   */
  migrate(folder?: string): Promise<void>;
  close(): Promise<void>;
};

export async function createDatabase(): Promise<TestDatabase> {
  const url = process.env.TEST_DATABASE_URL;
  return url ? createPostgres(url) : createEmbedded();
}

/**
 * Run one test against a database of its own, and give it back afterwards.
 *
 * A shared database would have tests fighting over the same schema names, and
 * the suite runs its files in parallel, so isolation here is per call.
 */
export async function withDatabase<T>(fn: (client: SqlClient) => Promise<T>): Promise<T> {
  const database = await createDatabase();
  try {
    return await fn(database.client);
  } finally {
    await database.close();
  }
}

/** The same, with the migration chain already applied. */
export async function withMigratedDatabase<T>(fn: (client: SqlClient) => Promise<T>): Promise<T> {
  const database = await createDatabase();
  try {
    await database.migrate();
    return await fn(database.client);
  } finally {
    await database.close();
  }
}

/**
 * The same, handing the test the Drizzle client the Master store speaks to,
 * and the log of the statements it has sent.
 */
export async function withMigratedDb<T>(
  fn: (db: MasterDb, client: SqlClient, statements: string[]) => Promise<T>
): Promise<T> {
  const database = await createDatabase();
  try {
    await database.migrate();
    return await fn(database.db, database.client, database.statements);
  } finally {
    await database.close();
  }
}

/** A Drizzle logger that records each statement into `statements`. */
function recordInto(statements: string[]) {
  return { logQuery: (query: string) => void statements.push(query) };
}

function createEmbedded(): TestDatabase {
  const pglite = new PGlite();
  const statements: string[] = [];
  return {
    client: pgliteClient(pglite),
    db: drizzleEmbedded(pglite, { schema, logger: recordInto(statements) }),
    statements,
    migrate: async (folder = migrationsFolder) => {
      await migrateEmbedded(drizzleEmbedded(pglite), { migrationsFolder: folder });
      await resetSearchPath(pgliteClient(pglite));
    },
    close: () => pglite.close()
  };
}

/**
 * The legacy dump's baseline opens with pg_dump's
 * `set_config('search_path', '', false)`, which sticks to the test's single
 * session. Every real request runs on a fresh connection whose default is
 * `public`, so put the session back the way the application finds it.
 */
async function resetSearchPath(client: SqlClient): Promise<void> {
  await client.exec("set search_path = public");
}

/**
 * A database of its own, created and dropped around the caller.
 *
 * `pg` and drizzle's node-postgres adapter are imported here rather than at the
 * top of the file: the embedded run has no use for either, and pulling them in
 * would put a second Postgres client on a path that never speaks to one.
 */
async function createPostgres(url: string): Promise<TestDatabase> {
  const { Client } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  const admin = new Client({ connectionString: url });
  await admin.connect();

  const name = `vmb_test_${randomUUID().replace(/-/g, "")}`;

  try {
    await admin.query(`create database "${name}"`);

    const client = new Client({ connectionString: databaseUrl(url, name) });
    await client.connect();
    const statements: string[] = [];

    return {
      client: pgClient(client),
      db: drizzle(client, { schema, logger: recordInto(statements) }),
      statements,
      migrate: async (folder = migrationsFolder) => {
        await migrate(drizzle(client), { migrationsFolder: folder });
        await resetSearchPath(pgClient(client));
      },
      close: async () => {
        try {
          await client.end();
        } finally {
          await drop(admin, name);
        }
      }
    };
  } catch (error) {
    // a setup that failed must leave neither a database nor an open connection
    await drop(admin, name).catch(() => undefined);
    await admin.end().catch(() => undefined);
    throw error;
  }
}

async function drop(admin: PgClient, name: string): Promise<void> {
  await admin.query(`drop database if exists "${name}" with (force)`);
  await admin.end();
}

type PgClient = {
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
};

/** The same connection string, pointed at another database on the same server. */
function databaseUrl(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** Apply one synthetic fixture over an already-migrated database. */
export async function loadFixture(client: SqlClient, file: string): Promise<void> {
  const sql = await readFile(path.join(testDir, "fixtures", file), "utf8");
  await client.exec(sql);
}

/** A count, from a query returning one numeric column aliased `value`. */
export async function count(client: SqlClient, sql: string): Promise<number> {
  const rows = await client.query<{ value: number }>(sql);
  const value = rows[0]?.value;
  if (typeof value !== "number") {
    throw new Error(`expected a numeric value aliased "value" from: ${sql}`);
  }
  return value;
}

/** Assert that a statement is refused by the database, for a reason. */
export async function rejects(client: SqlClient, sql: string, pattern: RegExp): Promise<void> {
  await expect(client.exec(sql)).rejects.toThrow(pattern);
}

/** A single value from a query that must return exactly one row and column. */
export async function scalar<T>(client: SqlClient, sql: string): Promise<T> {
  const rows = await client.query<Record<string, T>>(sql);
  const row = rows[0];
  if (rows.length !== 1 || !row) {
    throw new Error(`expected exactly one row from: ${sql}`);
  }
  const values = Object.values(row);
  if (values.length !== 1) {
    throw new Error(`expected exactly one column from: ${sql}`);
  }
  return values[0] as T;
}
