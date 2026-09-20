#!/usr/bin/env node
import { PGlite } from "@electric-sql/pglite";
import { pgClient, pgliteClient, type SqlClient } from "../sql-client.js";
import { migrationsFolder } from "../migrations-path.js";
import { importSnapshot, summarise } from "./run.js";
import { isClean } from "./verify.js";

/**
 * Run the import pipeline against a legacy data snapshot.
 *
 *   pnpm --filter @vmb/db db:import --snapshot <file> [--url <postgres url>] [--database <dir>]
 *
 * With neither target it runs against a throwaway in-memory database — the dry
 * run, which proves the snapshot loads and the chain replays over it. `--url`
 * reaches a Neon branch; `--database` keeps an embedded database on disk.
 *
 * The target is wiped before the load: the pipeline owns the database it is
 * pointed at.
 */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const snapshotFile = arg("snapshot");
if (!snapshotFile) {
  console.error("usage: db:import --snapshot <file> [--url <postgres url>] [--database <dir>]");
  process.exit(2);
}

const url = arg("url");
const dataDir = arg("database");

let client: SqlClient;
let close: () => Promise<void>;

if (url) {
  const { Client } = await import("pg");
  const pg = new Client({ connectionString: url });
  await pg.connect();
  client = pgClient(pg);
  close = async () => {
    await pg.end();
  };
} else {
  const pglite = new PGlite(dataDir);
  client = pgliteClient(pglite);
  close = async () => {
    await pglite.close();
  };
}

try {
  const report = await importSnapshot(client, snapshotFile, migrationsFolder);
  console.log(summarise(report));
  process.exitCode = isClean(report) ? 0 : 1;
} finally {
  await close();
}
