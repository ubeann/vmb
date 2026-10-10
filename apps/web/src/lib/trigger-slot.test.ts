import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// app.css sizes `[data-slot="button"]` to 44px for touch pointers and gives it the full-strength
// focus ring. A popover, dropdown, sheet or dialog part rendered through `Button` with
// `{#snippet child({ props })}` spreads the primitive's props, whose own `data-slot` replaces the
// button's, so the trigger stays 32px on a touch screen (ADR-0035, 2026-10-11). Such a `Button`
// passes `data-slot="button"` after the spread.

const src = fileURLToPath(new URL("..", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".svelte") ? [path] : [];
  });
}

/** Each `<Button …>` start tag in a file, skipping `>` inside `{…}` expressions. */
function buttonTags(source: string): { tag: string; line: number }[] {
  const tags: { tag: string; line: number }[] = [];
  for (const match of source.matchAll(/<Button\b/g)) {
    let depth = 0;
    let end = match.index;
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0) break;
    }
    tags.push({
      tag: source.slice(match.index, end + 1),
      line: source.slice(0, match.index).split("\n").length
    });
  }
  return tags;
}

function slotlessTriggers(path: string): string[] {
  return buttonTags(readFileSync(path, "utf8")).flatMap(({ tag, line }) => {
    const spread = tag.indexOf("{...props}");
    if (spread === -1) return [];
    const kept = tag.indexOf('data-slot="button"', spread) !== -1;
    return kept ? [] : [`${relative(src, path)}:${line}`];
  });
}

describe("Button-rendered triggers", () => {
  it("keep the button slot after the primitive's props", () => {
    expect(files(src).flatMap(slotlessTriggers)).toEqual([]);
  });

  it("finds the triggers it checks", () => {
    const columnsMenu = join(src, "lib/components/list/ColumnsMenu.svelte");
    const tags = buttonTags(readFileSync(columnsMenu, "utf8"));
    expect(tags.some(({ tag }) => tag.includes("{...props}"))).toBe(true);
  });
});
