import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OG_IMAGE } from "./lib/page-meta.js";

const staticDir = fileURLToPath(new URL("../static", import.meta.url));
const appHtml = readFileSync(fileURLToPath(new URL("app.html", import.meta.url)), "utf8");
const linked = [...appHtml.matchAll(/%sveltekit\.assets%(\/[^"]+)/g)].map((match) => match[1]);

// #207: the favicon link pointed at a file that never existed, so every page
// requested a 404. Each asset the head links must ship in static/.
describe("static assets", () => {
  it("links the icon set from app.html", () => {
    expect(linked).toEqual(
      expect.arrayContaining(["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png"])
    );
  });

  it.each([...linked, OG_IMAGE.path, "/robots.txt"])("ships %s", (path) => {
    expect(existsSync(`${staticDir}${path}`)).toBe(true);
  });

  // ADR-0047: a script without the per-request nonce is blocked by the CSP.
  it("gives every inline script in app.html the CSP nonce", () => {
    const scripts = [...appHtml.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);

    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(script).toContain('nonce="%sveltekit.nonce%"');
  });

  // The first-paint script colours the browser chrome through this meta, so it
  // must already be parsed when the script runs.
  it("puts the theme-color meta ahead of the first-paint script", () => {
    const meta = appHtml.indexOf('<meta name="theme-color"');

    expect(meta).toBeGreaterThan(-1);
    expect(meta).toBeLessThan(appHtml.indexOf("<script"));
  });

  it("keeps every page out of search indexes", () => {
    expect(appHtml).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  it("disallows crawlers except the link-preview bots", () => {
    const robots = readFileSync(`${staticDir}/robots.txt`, "utf8");
    expect(robots).toMatch(/User-agent: \*\nDisallow: \/\n/);
    for (const bot of ["Slackbot-LinkExpanding", "Twitterbot", "facebookexternalhit", "WhatsApp"]) {
      expect(robots).toContain(`User-agent: ${bot}\n`);
    }
  });
});
