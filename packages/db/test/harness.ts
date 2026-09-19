import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.resolve(testDir, "../drizzle");

/**
 * A fresh in-memory Postgres with the whole migration chain applied.
 *
 * Embedded Postgres keeps the harness service-free and secret-free. A
 * real-Postgres CI job runs the same fixtures to guard against divergence
 * between the two.
 */
export async function migratedDatabase(): Promise<PGlite> {
  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder });
  return client;
}

/** Apply one synthetic fixture over an already-migrated database. */
export async function loadFixture(client: PGlite, file: string): Promise<void> {
  const sql = await readFile(path.join(testDir, "fixtures", file), "utf8");
  await client.exec(sql);
}

/** A count, from a query returning one numeric column aliased `value`. */
export async function count(client: PGlite, sql: string): Promise<number> {
  const result = await client.query<{ value: number }>(sql);
  const value = result.rows[0]?.value;
  if (typeof value !== "number") {
    throw new Error(`expected a numeric value aliased "value" from: ${sql}`);
  }
  return value;
}

/** A single value from a query that must return exactly one row and column. */
export async function scalar<T>(client: PGlite, sql: string): Promise<T> {
  const result = await client.query<Record<string, T>>(sql);
  const row = result.rows[0];
  if (result.rows.length !== 1 || !row) {
    throw new Error(`expected exactly one row from: ${sql}`);
  }
  const values = Object.values(row);
  if (values.length !== 1) {
    throw new Error(`expected exactly one column from: ${sql}`);
  }
  return values[0] as T;
}
