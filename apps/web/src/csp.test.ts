import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Config } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";

// svelte.config.js is plain JS outside the typed project; import it untyped.
const configPath: string = "../svelte.config.js";
const {
  default: config,
  MODE_WATCHER_STYLE_HASH,
  EMPTY_STYLE_HASH
} = (await import(/* @vite-ignore */ configPath)) as {
  default: Config;
  MODE_WATCHER_STYLE_HASH: string;
  EMPTY_STYLE_HASH: string;
};

const enforced = config.kit?.csp?.directives;
const reportOnly = config.kit?.csp?.reportOnly;
const sha256 = (text: string) => `sha256-${createHash("sha256").update(text).digest("base64")}`;

// mode-watcher exports no path to its files, so read it through the symlink.
const withoutTransition = readFileSync(
  new URL("../node_modules/mode-watcher/dist/without-transition.js", import.meta.url),
  "utf8"
);

// bits-ui exports no path to its files either.
const pinInput = readFileSync(
  new URL("../node_modules/bits-ui/dist/bits/pin-input/pin-input.svelte.js", import.meta.url),
  "utf8"
);

describe("the CSP (ADR-0047)", () => {
  it("allows the exact <style> mode-watcher adds while the scheme changes", () => {
    const sheet = withoutTransition.match(/createTextNode\(`([^`]*)`\)/)?.[1];
    expect(sheet, "mode-watcher no longer builds its sheet this way").toBeDefined();

    const hash = sha256(sheet!);

    expect(MODE_WATCHER_STYLE_HASH).toBe(hash);
    expect(enforced?.["style-src-elem"]).toContain(hash);
    expect(reportOnly?.["style-src-elem"]).toContain(hash);
  });

  it("allows the empty <style> bits-ui's PinInput appends", () => {
    // it fills the element through insertRule, so only the empty element is needed
    expect(pinInput).toMatch(
      /createElement\("style"\)[\s\S]*?"pin-input-style"[\s\S]*?appendChild/
    );
    expect(pinInput, "PinInput now gives its <style> text").not.toMatch(
      /styleEl\.textContent|styleEl\.innerHTML/
    );

    expect(EMPTY_STYLE_HASH).toBe(sha256(""));
    expect(enforced?.["style-src-elem"]).toContain(EMPTY_STYLE_HASH);
    expect(reportOnly?.["style-src-elem"]).toContain(EMPTY_STYLE_HASH);
  });

  it("enforces a policy and measures a tighter one beside it", () => {
    expect(enforced?.["script-src"]).toEqual(["self"]);
    expect(enforced?.["style-src-attr"]).toEqual(["unsafe-inline"]);

    expect(reportOnly?.["script-src"]).toEqual(["strict-dynamic"]);
    expect({ ...reportOnly, "script-src": enforced?.["script-src"] }).toEqual(enforced);
  });

  it.each([
    ["enforced", enforced],
    ["report-only", reportOnly]
  ])("names a report endpoint in the %s policy", (_name, policy) => {
    expect(policy?.["report-to"]).toEqual(["csp"]);
    expect(policy?.["report-uri"]).toEqual(["/csp-report"]);
  });
});
