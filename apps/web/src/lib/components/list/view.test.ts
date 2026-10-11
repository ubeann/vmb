import { describe, expect, it } from "vitest";
import {
  DATE_ORDER,
  TEXT_ORDER,
  orderChoices,
  pickField,
  sortChanges,
  viewDiffers,
  type SortField
} from "./view.js";

const name: SortField = { sort: "name", label: "Name", ...TEXT_ORDER };
const updated: SortField = { sort: "updatedAt", label: "Last updated", ...DATE_ORDER };
const defaults = { sort: "name", dir: "asc" } as const;

describe("orderChoices", () => {
  it("lists a text column A to Z first and a date column newest first", () => {
    expect(orderChoices(name)).toEqual([
      { dir: "asc", label: "A to Z" },
      { dir: "desc", label: "Z to A" }
    ]);
    expect(orderChoices(updated)).toEqual([
      { dir: "desc", label: "Newest first" },
      { dir: "asc", label: "Oldest first" }
    ]);
  });
});

describe("pickField", () => {
  it("starts each column in its natural order", () => {
    expect(pickField(name)).toEqual({ sort: "name", dir: "asc" });
    expect(pickField(updated)).toEqual({ sort: "updatedAt", dir: "desc" });
  });
});

describe("sortChanges", () => {
  it("drops each parameter that equals the default", () => {
    expect(sortChanges({ sort: "name", dir: "asc" }, defaults)).toEqual({ sort: null, dir: null });
    expect(sortChanges({ sort: "name", dir: "desc" }, defaults)).toEqual({
      sort: null,
      dir: "desc"
    });
    expect(sortChanges({ sort: "updatedAt", dir: "asc" }, defaults)).toEqual({
      sort: "updatedAt",
      dir: null
    });
    expect(sortChanges({ sort: "updatedAt", dir: "desc" }, defaults)).toEqual({
      sort: "updatedAt",
      dir: "desc"
    });
  });
});

describe("viewDiffers", () => {
  const base = { columnsChanged: false, perPage: 25, sort: defaults, defaults, folded: false };

  it("is false for the defaults", () => {
    expect(viewDiffers(base)).toBe(false);
  });

  it("sees a changed column or page size", () => {
    expect(viewDiffers({ ...base, columnsChanged: true })).toBe(true);
    expect(viewDiffers({ ...base, perPage: 50 })).toBe(true);
  });

  it("counts the sort only where View holds it", () => {
    const sorted = { ...base, sort: { sort: "code", dir: "desc" } as const };
    expect(viewDiffers(sorted)).toBe(false);
    expect(viewDiffers({ ...sorted, folded: true })).toBe(true);
  });
});
