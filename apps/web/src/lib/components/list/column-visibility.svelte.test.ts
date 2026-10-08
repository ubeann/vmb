import { beforeEach, describe, expect, it } from "vitest";
import { ColumnVisibility } from "./column-visibility.svelte.js";

const COLUMNS = [
  { id: "name", label: "Name", hideable: false },
  { id: "code", label: "Code" },
  { id: "createdAt", label: "Created", hidden: true }
] as const;

beforeEach(() => localStorage.clear());

describe("ColumnVisibility", () => {
  it("starts from each column's default", () => {
    const columns = new ColumnVisibility("divisions", COLUMNS);
    expect(columns.visible("code")).toBe(true);
    expect(columns.visible("createdAt")).toBe(false);
  });

  it("saves a change for that list only, and reads it back", () => {
    new ColumnVisibility("divisions", COLUMNS).set("code", false);

    const again = new ColumnVisibility("divisions", COLUMNS);
    again.restore();
    expect(again.visible("code")).toBe(false);

    const other = new ColumnVisibility("users", COLUMNS);
    other.restore();
    expect(other.visible("code")).toBe(true);
  });

  it("never hides a column that can't be hidden, whatever storage says", () => {
    localStorage.setItem("vmb:list-columns:divisions", JSON.stringify({ name: false }));
    const columns = new ColumnVisibility("divisions", COLUMNS);
    columns.restore();
    columns.set("name", false);
    expect(columns.visible("name")).toBe(true);
  });

  it("ignores storage it can't read", () => {
    localStorage.setItem("vmb:list-columns:divisions", "not json");
    const columns = new ColumnVisibility("divisions", COLUMNS);
    columns.restore();
    expect(columns.visible("code")).toBe(true);
  });
});
