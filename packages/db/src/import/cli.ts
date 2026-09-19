#!/usr/bin/env node
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importSnapshot, summarise } from "./run.js";
import { clean } from "./run.js";

/**
 * Run the import pipeline against a legacy data snapshot.
 *
 *   pnpm --filter @vmb/db import -- --snapshot <pg_dump --data-only file> [--database <path>]
 *
 * Without `--database` the pipeline runs against a throwaway in-memory database,
 * which is the dry run: it proves the snapshot loads and the chain replays over
 * it, and prints the report. Point `--database` at a local data directory to
 * keep the result.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../drizzle");

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const snapshotFile = arg("snapshot");
if (!snapshotFile) {
  console.error("usage: import --snapshot <file> [--database <path>]");
  process.exit(2);
}

const client = new PGlite(arg("database"));
try {
  const report = await importSnapshot(client, snapshotFile, migrationsFolder);
  console.log(summarise(report));
  process.exitCode = clean(report) ? 0 : 1;
} finally {
  await client.close();
}
