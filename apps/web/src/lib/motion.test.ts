import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { duration } from "./motion.js";

const css = readFileSync(fileURLToPath(new URL("../app.css", import.meta.url)), "utf8");

// A Svelte transition reading a stale number would drift from the CSS motion
// beside it, so the TS mirror must match the tokens exactly.
describe("motion durations", () => {
  it.each(Object.entries(duration))("mirrors --duration-%s", (name, ms) => {
    expect(css).toMatch(new RegExp(`--duration-${name}:\\s*${ms}ms;`));
  });
});
