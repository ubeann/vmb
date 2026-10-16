import { describe, expect, it } from "vitest";
import { iconLabel, resolveIcon } from "../hero-icons.js";
import { CATALOG, CATEGORIES, searchIcons, suggestIcons } from "./catalog.js";
import { GLYPHS } from "./glyphs.js";

const names = (icons: { name: string }[]) => icons.map((icon) => icon.name);

describe("the icon catalogue", () => {
  it("offers each icon once, and draws each one it offers", () => {
    expect(new Set(names(CATALOG)).size).toBe(CATALOG.length);
    for (const icon of CATALOG) expect(GLYPHS[icon.name]).toBeDefined();
    expect(CATEGORIES.every((category) => category.icons.length > 0)).toBe(true);
  });

  it("finds icons by name, label, keyword and group, every word a beginning", () => {
    expect(names(searchIcons("money"))).toEqual(
      expect.arrayContaining(["banknote", "wallet", "coins"])
    );
    expect(names(searchIcons("ship"))).toEqual(
      expect.arrayContaining(["ship", "truck", "container"])
    );
    expect(names(searchIcons("customer service"))).toContain("headset");
    expect(names(searchIcons("logistics fork"))).toEqual(["forklift"]);
    expect(searchIcons("  ")).toEqual([]);
    expect(searchIcons("zzz")).toEqual([]);
  });

  it("suggests icons from a record's name", () => {
    expect(names(suggestIcons("Finance")).slice(0, 2)).toEqual(["banknote", "wallet"]);
    expect(names(suggestIcons("Trucking"))).toContain("truck");
    expect(names(suggestIcons("Health, Safety & Environment"))).toEqual(
      expect.arrayContaining(["hard-hat", "recycle"])
    );
    expect(suggestIcons("Finance", 3)).toHaveLength(3);
    // words that say nothing about the work suggest nothing
    expect(suggestIcons("General Division")).toEqual([]);
    expect(suggestIcons("")).toEqual([]);
  });
});

describe("resolveIcon and iconLabel", () => {
  it("draws a stored Lucide name as it is and a legacy Heroicons one through its map", () => {
    expect(resolveIcon("wallet")).toBe("wallet");
    expect(resolveIcon("heroicon-o-truck")).toBe("truck");
    expect(resolveIcon("heroicon-o-currency-dollar")).toBe("circle-dollar-sign");
    expect(resolveIcon("heroicon-o-beaker")).toBeNull();
    expect(resolveIcon("not-an-icon")).toBeNull();
  });

  it("names an icon as the picker does, else by what is stored", () => {
    expect(iconLabel("heroicon-o-banknotes")).toBe("Banknotes");
    expect(iconLabel("forklift")).toBe("Forklift");
    expect(iconLabel("heroicon-o-beaker")).toBe("heroicon-o-beaker");
  });
});
