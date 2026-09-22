#!/usr/bin/env node
import { arg, duration } from "../cli.js";
import { pgClient } from "../sql-client.js";
import { migrationsFolder } from "../migrations-path.js";
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
const url = arg("url") ?? process.env.DATABASE_URL;
if (!url) {
  console.error("usage: db:migrate [--url <postgres url>]  (DATABASE_URL is the default)");
  process.exit(2);
}

const { Client } = await import("pg");
const pg = new Client({ connectionString: url });
await pg.connect();

try {
  const results = await applyMigrations(pgClient(pg), migrationsFolder, (migration) => {
    console.log(
      migration.applied
        ? `${migration.tag} applied in ${duration(migration.milliseconds)}`
        : `${migration.tag} already applied`
    );
  });

  const applied = results.filter((migration) => migration.applied).length;
  const total = results.reduce((sum, migration) => sum + migration.milliseconds, 0);
  console.log(
    `applied ${applied} of ${results.length} migrations in ${duration(total)} ` +
      `(${results.length - applied} already applied)`
  );
} finally {
  await pg.end();
}
