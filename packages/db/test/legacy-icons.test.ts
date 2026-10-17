import { HEROICON_LUCIDE, ICON_NAMES, lucideForLegacyIcon } from "@vmb/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrationsFolder } from "./harness.js";

describe("the Heroicons-to-Lucide map", () => {
  it("equals the map migration 0032 rewrote the chain's rows with", async () => {
    const sql = await readFile(path.join(migrationsFolder, "0032_lucide_icon_names.sql"), "utf8");
    const values = sql.slice(sql.indexOf('INSERT INTO "heroicon_lucide"'), sql.indexOf("UPDATE"));
    const fromMigration = Object.fromEntries(
      [...values.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((pair) => [pair[1], pair[2]])
    );

    expect(Object.keys(fromMigration).length).toBeGreaterThan(150);
    expect(HEROICON_LUCIDE).toEqual(fromMigration);
  });

  it("maps only onto catalogue icons", () => {
    const catalogue = new Set<string>(ICON_NAMES);
    expect(Object.values(HEROICON_LUCIDE).filter((icon) => !catalogue.has(icon))).toEqual([]);
  });

  it("rewrites a stored name the way the migration does, in any variant", () => {
    expect(lucideForLegacyIcon("heroicon-o-truck")).toBe("truck");
    expect(lucideForLegacyIcon("heroicon-s-rocket-launch")).toBe("rocket");
    // no counterpart, already Lucide, or not a Heroicons name at all: unchanged
    expect(lucideForLegacyIcon("heroicon-o-arrow-left")).toBe("heroicon-o-arrow-left");
    expect(lucideForLegacyIcon("wallet")).toBe("wallet");
    expect(lucideForLegacyIcon("heroicon-o-constructor")).toBe("heroicon-o-constructor");
  });
});
