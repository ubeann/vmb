import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Config } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";

// svelte.config.js is plain JS outside the typed project; import it untyped.
const configPath: string = "../svelte.config.js";
const { default: config, MODE_WATCHER_STYLE_HASH } = (await import(
  /* @vite-ignore */ configPath
)) as { default: Config; MODE_WATCHER_STYLE_HASH: string };

// mode-watcher exports no path to its files, so read it through the symlink.
const withoutTransition = readFileSync(
  new URL("../node_modules/mode-watcher/dist/without-transition.js", import.meta.url),
  "utf8"
);

describe("the CSP (ADR-0047)", () => {
  it("allows the exact <style> mode-watcher adds while the scheme changes", () => {
    const sheet = withoutTransition.match(/createTextNode\(`([^`]*)`\)/)?.[1];
    expect(sheet, "mode-watcher no longer builds its sheet this way").toBeDefined();

    const hash = `sha256-${createHash("sha256").update(sheet!).digest("base64")}`;

    expect(MODE_WATCHER_STYLE_HASH).toBe(hash);
    expect(config.kit?.csp?.reportOnly?.["style-src-elem"]).toContain(hash);
  });

  it("names a report endpoint, which report-only requires", () => {
    const policy = config.kit?.csp?.reportOnly;

    expect(policy?.["report-to"]).toEqual(["csp"]);
    expect(policy?.["report-uri"]).toEqual(["/csp-report"]);
  });
});
