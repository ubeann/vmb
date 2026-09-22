#!/usr/bin/env node
import { arg, duration } from "../cli.js";
import { pgClient } from "../sql-client.js";
import { PREVIEW_USER_EMAIL, PREVIEW_USER_PASSWORD } from "./data/master.js";
import { seed } from "./run.js";

/**
 * Replace every row in a migrated database with the deterministic preview
 * fixtures.
 *
 *   pnpm --filter @vmb/db db:seed [--url <postgres url>]
 *
 * `DATABASE_URL` is the default target, like `db:migrate`. The target must be
 * a throwaway database: the wipe truncates every table in the five application
 * schemas, so running this against production would delete production's rows.
 * `drizzle.__drizzle_migrations` survives, so `db:migrate` still applies only
 * what is missing.
 *
 * The preview login is printed because it is a committed, preview-only
 * credential — the workflow log is a legitimate place to read it from.
 */
const url = arg("url") ?? process.env.DATABASE_URL;
if (!url) {
  console.error("usage: db:seed [--url <postgres url>]  (DATABASE_URL is the default)");
  process.exit(2);
}

const { Client } = await import("pg");
const pg = new Client({ connectionString: url });
await pg.connect();

try {
  const report = await seed(pgClient(pg));
  console.log(
    `seeded ${report.rows} rows across ${report.tables} tables in ${duration(report.milliseconds)}`
  );
  console.log(`preview login: ${PREVIEW_USER_EMAIL} / ${PREVIEW_USER_PASSWORD}`);
} finally {
  await pg.end();
}
