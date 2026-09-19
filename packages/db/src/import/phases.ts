import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { baselineMigrationTag } from "./manifest.js";

export type Phase = "baseline" | "after";

export type Migration = {
  tag: string;
  /** `baseline` creates the legacy shape; `after` runs over the loaded rows. */
  phase: Phase;
  /** Statements, split exactly as the migrator splits them. */
  statements: string[];
  hash: string;
  folderMillis: number;
};

type Journal = {
  entries: { idx: number; tag: string; when: number }[];
};

/**
 * The chain in two phases, split at the baseline.
 *
 * The baseline must run before the snapshot is loaded, and everything after it
 * must run over the loaded rows — the order ADR-0024 describes. Reading the same
 * journal the migrator reads keeps the two in step: nothing is hand-listed.
 */
export async function readChain(migrationsFolder: string): Promise<Migration[]> {
  const journal = JSON.parse(
    await readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8")
  ) as Journal;

  const baselineIndex = journal.entries.findIndex((entry) => entry.tag === baselineMigrationTag);
  if (baselineIndex === -1) {
    throw new Error(`the journal has no ${baselineMigrationTag} entry`);
  }

  const migrations: Migration[] = [];
  for (const entry of journal.entries) {
    const sql = await readFile(path.join(migrationsFolder, `${entry.tag}.sql`), "utf8");
    migrations.push({
      tag: entry.tag,
      phase: entry.idx <= baselineIndex ? "baseline" : "after",
      statements: sql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean),
      hash: createHash("sha256").update(sql).digest("hex"),
      folderMillis: entry.when
    });
  }
  return migrations;
}

export function byPhase(migrations: Migration[], phase: Phase): Migration[] {
  return migrations.filter((migration) => migration.phase === phase);
}
