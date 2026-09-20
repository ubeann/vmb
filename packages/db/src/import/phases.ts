import { baselineMigrationTag } from "./manifest.js";
import { readMigrations, type Migration as ChainMigration } from "../migration/chain.js";

export type Phase = "baseline" | "after";

export type Migration = ChainMigration & {
  /** `baseline` creates the legacy shape; `after` runs over the loaded rows. */
  phase: Phase;
};

/**
 * The chain in two phases, split at the baseline.
 *
 * The baseline must run before the snapshot is loaded, and everything after it
 * must run over the loaded rows — the order ADR-0024 describes. Reading the same
 * journal the migrator reads keeps the two in step: nothing is hand-listed.
 */
export async function readChain(migrationsFolder: string): Promise<Migration[]> {
  const migrations = await readMigrations(migrationsFolder);
  const baselineIndex = migrations.findIndex((migration) => migration.tag === baselineMigrationTag);
  if (baselineIndex === -1) {
    throw new Error(`the journal has no ${baselineMigrationTag} entry`);
  }

  return migrations.map((migration, index) => ({
    ...migration,
    phase: index <= baselineIndex ? "baseline" : "after"
  }));
}

export function byPhase(migrations: Migration[], phase: Phase): Migration[] {
  return migrations.filter((migration) => migration.phase === phase);
}
