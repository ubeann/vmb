import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** One migration in the chain, read the way the migrator reads it. */
export type Migration = {
  tag: string;
  /** Statements, split exactly as the migrator splits them. */
  statements: string[];
  /** sha256 of the file, the identity Drizzle journals. */
  hash: string;
  /** The journal's `when`, the ordering Drizzle journals as `created_at`. */
  folderMillis: number;
};

type Journal = {
  entries: { idx: number; tag: string; when: number }[];
};

/**
 * Read every migration in the chain, in journal order.
 *
 * The one reader of `meta/_journal.json`: the migrator replays what it returns
 * and the import pipeline splits it into phases, so neither hand-lists a tag and
 * the two cannot drift from the journal Drizzle itself reads.
 */
export async function readMigrations(migrationsFolder: string): Promise<Migration[]> {
  const journal = JSON.parse(
    await readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8")
  ) as Journal;

  const migrations: Migration[] = [];
  for (const entry of journal.entries) {
    const sql = await readFile(path.join(migrationsFolder, `${entry.tag}.sql`), "utf8");
    migrations.push({
      tag: entry.tag,
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
