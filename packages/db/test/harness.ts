import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));

/** The real Drizzle Kit migration chain — never a fixture of it. */
export const migrationsFolder = path.resolve(testDir, "../drizzle");

/**
 * A fresh in-memory Postgres with the full migration chain applied.
 *
 * Embedded Postgres (PGlite) keeps the harness service-free and secret-free;
 * the same chain runs against a real Postgres in CI, which guards against
 * divergence between the two.
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

/** Run a query expected to return exactly one row and one column. */
export async function scalar<T>(client: PGlite, sql: string): Promise<T> {
  const result = await client.query<Record<string, T>>(sql);
  const row = result.rows[0];
  if (!row) throw new Error(`expected one row from: ${sql}`);
  return Object.values(row)[0];
}
