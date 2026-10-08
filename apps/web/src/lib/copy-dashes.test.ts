import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Interface copy breaks a sentence with a full stop, a colon or a comma, not an
// em dash: a dash between clauses reads as machine-written, and it is harder
// for people reading English as a second language. Three uses are typography,
// not sentences, and stay: the separator in a page title ("Users — VMB"), the
// lone "—" that marks an empty value, and en dashes in ranges ("3–5").
// Comments are not copy, so they are left out.

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const sources = ["apps/web/src", "apps/api/src"];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    const copy = /\.(svelte|ts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name);
    return copy ? [path] : [];
  });
}

// Comments become spaces of the same length, so line numbers still match.
const blank = (text: string) => text.replace(/[^\n]/g, " ");
const withoutComments = (source: string) =>
  source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`])\/\/.*$/gm, (_, before: string) => before);

const allowed = [
  /"—"/g, // the empty-value mark
  / — (VMB|\$\{SITE_NAME\})/g // a page title's separator
];

function dashesIn(path: string): string[] {
  return withoutComments(readFileSync(path, "utf8"))
    .split("\n")
    .flatMap((line, index) => {
      const copy = allowed.reduce((text, pattern) => text.replace(pattern, ""), line);
      return copy.includes("—") ? [`${relative(root, path)}:${index + 1}: ${line.trim()}`] : [];
    });
}

describe("interface copy", () => {
  it("breaks sentences without an em dash", () => {
    const found = sources.flatMap((source) => files(join(root, source))).flatMap(dashesIn);

    expect(found).toEqual([]);
  });
});
