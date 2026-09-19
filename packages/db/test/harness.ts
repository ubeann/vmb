import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pgClient, pgliteClient, type SqlClient } from "../src/import/client.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

/** The real Drizzle Kit migration chain — never a fixture of it. */
export const migrationsFolder = path.resolve(testDir, "../drizzle");

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
  /** Replay the whole chain with drizzle's migrator, as a deployment would. */
  migrate(): Promise<void>;
  close(): Promise<void>;
};

export async function createDatabase(): Promise<TestDatabase> {
  const url = process.env.TEST_DATABASE_URL;
  return url ? createPostgres(url) : createEmbedded();
}

function createEmbedded(): TestDatabase {
  const pglite = new PGlite();
  return {
    client: pgliteClient(pglite),
    migrate: async () => {
      const { drizzle } = await import("drizzle-orm/pglite");
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(drizzle(pglite), { migrationsFolder });
    },
    close: () => pglite.close()
  };
}

/**
 * A database of its own, created and dropped around the test that asked for it.
 *
 * A shared database would have every test fighting over the same schema names,
 * and the suite runs its files in parallel; a fresh database per test is the
 * cheapest isolation that keeps the tests identical to the embedded run.
 */
async function createPostgres(url: string): Promise<TestDatabase> {
  const { Client } = await import("pg");

  const admin = new Client({ connectionString: url });
  await admin.connect();

  const name = `vmb_test_${randomUUID().replace(/-/g, "")}`;
  await admin.query(`create database "${name}"`);

  const client = new Client({ connectionString: databaseUrl(url, name) });
  await client.connect();

  return {
    client: pgClient(client),
    migrate: async () => {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(drizzle(client), { migrationsFolder });
    },
    close: async () => {
      await client.end();
      await admin.query(`drop database if exists "${name}" with (force)`);
      await admin.end();
    }
  };
}

/** The same connection string, pointed at another database on the same server. */
function databaseUrl(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** Apply one synthetic fixture over an already-migrated database. */
export async function loadFixture(client: SqlClient, file: string): Promise<void> {
  const { readFile } = await import("node:fs/promises");
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
