import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// app.css sizes `[data-slot="button"]` to 44px for touch pointers and gives it the full-strength
// focus ring. A popover, dropdown, sheet or dialog part rendered through `Button` with
// `{#snippet child({ props })}` spreads the primitive's props, whose own `data-slot` replaces the
// button's, so the trigger stays 32px on a touch screen (ADR-0035, 2026-10-11). Such a `Button`
// passes `data-slot="button"` after the spread. A primitive's trigger dressed as a button with
// `buttonVariants` sets its own slot the same way.

const src = fileURLToPath(new URL("..", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".svelte") ? [path] : [];
  });
}

/** Each start tag matching `open` in a file, skipping `>` inside `{…}` expressions. */
function startTags(source: string, open = /<Button\b/g): { tag: string; line: number }[] {
  const tags: { tag: string; line: number }[] = [];
  for (const match of source.matchAll(open)) {
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
  const source = readFileSync(path, "utf8");
  const spreads = startTags(source).flatMap(({ tag, line }) => {
    const spread = tag.indexOf("{...props}");
    if (spread === -1) return [];
    return tag.indexOf('data-slot="button"', spread) === -1 ? [line] : [];
  });
  const dressed = startTags(source, /<\w+\.(Trigger|Close)\b/g).flatMap(({ tag, line }) =>
    tag.includes("buttonVariants(") && !tag.includes('data-slot="button"') ? [line] : []
  );
  return [...spreads, ...dressed].map((line) => `${relative(src, path)}:${line}`);
}

describe("Button-rendered triggers", () => {
  it("keep the button slot after the primitive's props", () => {
    expect(files(src).flatMap(slotlessTriggers)).toEqual([]);
  });

  it("finds the triggers it checks", () => {
    const viewPanel = join(src, "lib/components/list/ViewPanel.svelte");
    const tags = startTags(readFileSync(viewPanel, "utf8"));
    expect(tags.some(({ tag }) => tag.includes("{...props}"))).toBe(true);

    const filterPanel = join(src, "lib/components/list/FilterPanel.svelte");
    const triggers = startTags(readFileSync(filterPanel, "utf8")).filter(({ tag }) =>
      tag.includes("{...props}")
    );
    expect(triggers).toHaveLength(1);
  });
});
