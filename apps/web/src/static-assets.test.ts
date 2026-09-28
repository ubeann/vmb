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
