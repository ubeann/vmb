import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../drizzle.config.js";
import { migrationsFolder } from "../src/migrations-path.js";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("the migration chain's location", () => {
  /**
   * drizzle-kit resolves `out` against its working directory, and every script
   * that runs it is a pnpm script, which sets that to the package directory.
   * The location is therefore spelled twice — here and in
   * `drizzle.config.ts` — and a drift would have `db:generate` write a chain
   * the tests never read. This is where that drift fails.
   */
  it("matches the directory drizzle-kit writes to", () => {
    const out = config.out;
    if (typeof out !== "string") {
      throw new Error("drizzle.config.ts must name its `out` directory");
    }

    expect(path.resolve(packageDir, out)).toBe(migrationsFolder);
  });
});
