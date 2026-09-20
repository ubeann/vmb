#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pgClient } from "../import/client.js";
import { applyMigrations } from "./apply.js";

/**
 * Replay the chain against a database.
 *
 *   pnpm --filter @vmb/db db:migrate [--url <postgres url>]
 *
 * `DATABASE_URL` is the default target, so the command this replaces keeps its
 * invocation. Each applied migration is logged with its duration — the chain
 * replays in one round trip per file, so on a remote database this log is the
 * measurement that says which one is slow.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../drizzle");

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const url = arg("url") ?? process.env.DATABASE_URL;
if (!url) {
  console.error("usage: db:migrate [--url <postgres url>]  (DATABASE_URL is the default)");
  process.exit(2);
}

const { Client } = await import("pg");
const pg = new Client({ connectionString: url });
await pg.connect();

try {
  const results = await applyMigrations(pgClient(pg), migrationsFolder);

  for (const migration of results.filter((migration) => migration.applied)) {
    console.log(`${migration.tag} applied in ${duration(migration.milliseconds)}`);
  }

  const applied = results.filter((migration) => migration.applied).length;
  const total = results.reduce((sum, migration) => sum + migration.milliseconds, 0);
  console.log(
    `applied ${applied} of ${results.length} migrations in ${duration(total)} ` +
      `(${results.length - applied} already applied)`
  );
} finally {
  await pg.end();
}

function duration(milliseconds: number): string {
  return milliseconds < 1000 ? `${milliseconds}ms` : `${(milliseconds / 1000).toFixed(1)}s`;
}
