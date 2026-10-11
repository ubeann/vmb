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

  it("reports a change from the defaults, and none once a column is put back", () => {
    const columns = new ColumnVisibility("divisions", COLUMNS);
    expect(columns.changed).toBe(false);
    columns.set("code", false);
    expect(columns.changed).toBe(true);
    columns.set("code", true);
    expect(columns.changed).toBe(false);
    columns.set("createdAt", true);
    expect(columns.changed).toBe(true);
  });

  it("resets to the defaults and forgets what it saved", () => {
    const columns = new ColumnVisibility("divisions", COLUMNS);
    columns.set("code", false);
    columns.set("createdAt", true);

    columns.reset();
    expect(columns.visible("code")).toBe(true);
    expect(columns.visible("createdAt")).toBe(false);
    expect(columns.changed).toBe(false);
    expect(localStorage.getItem("vmb:list-columns:divisions")).toBeNull();

    const again = new ColumnVisibility("divisions", COLUMNS);
    again.restore();
    expect(again.visible("code")).toBe(true);
  });
});
