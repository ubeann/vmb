import { describe, expect, it } from "vitest";
import { FALLBACK_ICON, heroiconToLucide } from "./hero-icons.js";

describe("heroiconToLucide", () => {
  it("maps a seeded outline name to its Lucide glyph", () => {
    expect(heroiconToLucide("heroicon-o-truck")).toBe("truck");
    expect(heroiconToLucide("heroicon-o-cog-6-tooth")).toBe("settings");
    expect(heroiconToLucide("heroicon-o-building-office-2")).toBe("building-2");
  });

  it("maps the schema default", () => {
    expect(heroiconToLucide("heroicon-o-rocket-launch")).toBe("rocket");
  });

  it("ignores the Heroicons variant prefix", () => {
    expect(heroiconToLucide("heroicon-s-truck")).toBe("truck");
    expect(heroiconToLucide("heroicon-m-user")).toBe("user");
  });

  it("falls back for unmapped, malformed or empty names", () => {
    expect(heroiconToLucide("heroicon-o-academic-cap")).toBe(FALLBACK_ICON);
    expect(heroiconToLucide("truck")).toBe(FALLBACK_ICON);
    expect(heroiconToLucide("heroicon-o-constructor")).toBe(FALLBACK_ICON);
    expect(heroiconToLucide("")).toBe(FALLBACK_ICON);
  });
});
