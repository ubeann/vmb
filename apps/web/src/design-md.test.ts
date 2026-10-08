import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// DESIGN.md mirrors app.css for design tools (impeccable's live panel reads its
// header). app.css stays the source; this keeps the mirror from drifting.
const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");
const design = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");

const header = design.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";

/** The `key: value` lines of one indented block in the YAML header. */
function block(name: string, indent = ""): Map<string, string> {
  const lines = header.split("\n");
  const start = lines.indexOf(`${indent}${name}:`);
  const entries = new Map<string, string>();
  if (start === -1) return entries;
  const child = `${indent}  `;
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith(child)) break;
    const [, key, value] = line.slice(child.length).match(/^([\w-]+): "?(.*?)"?$/) ?? [];
    if (key && value && !line.startsWith(`${child} `)) entries.set(key, value);
  }
  return entries;
}

/** The custom properties declared in the first `selector { … }` block of app.css. */
function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return new Map(
    [...body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, name = "", value = ""]) => [
      name,
      value
    ])
  );
}

const light = declarations(":root");
const dark = declarations(".dark");
const theme = declarations("@theme inline");

describe("DESIGN.md's token header", () => {
  it("has colours", () => {
    expect(block("colors").size).toBeGreaterThan(0);
  });

  it.each([...block("colors")])("matches app.css for %s", (key, value) => {
    const dashed = key.endsWith("-dark");
    const token = dashed ? key.slice(0, -"-dark".length) : key;
    expect(value).toBe((dashed ? dark : light).get(token));
  });

  it.each([
    ["brand-line", "font-display"],
    ["heading", "font-display"],
    ["body", "font-sans"],
    ["code", "font-mono"]
  ])("names %s in app.css's --%s face", (style, token) => {
    const family = (list?: string) => list?.split(",")[0]?.replaceAll('"', "").trim();
    expect(family(block(style, "  ").get("fontFamily"))).toBe(family(theme.get(token)));
  });

  it("derives the radii from --radius as app.css does", () => {
    const radius = Number.parseFloat(light.get("radius") ?? "");
    const rounded = block("rounded");
    for (const [step, scale] of [
      ["sm", 0.6],
      ["md", 0.8],
      ["lg", 1],
      ["xl", 1.4]
    ] as const) {
      expect(Number.parseFloat(rounded.get(step) ?? "")).toBeCloseTo(radius * scale, 4);
    }
  });
});
