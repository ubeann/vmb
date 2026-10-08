import { describe, expect, it } from "vitest";
import { trailFor } from "./breadcrumbs.js";
import type { NavGroup } from "./nav.js";

const finance = {
  label: "Finance",
  tile: { iconName: "heroicon-o-banknotes", colorHex: "#0f766e" }
};

const labels = (trail: ReturnType<typeof trailFor>) => trail.map((crumb) => crumb.label);

describe("trailFor", () => {
  it("shows the group as plain text, then the section, on a list", () => {
    const trail = trailFor("/master/divisions");

    expect(labels(trail)).toEqual(["Master", "Divisions"]);
    expect(trail[0]).toEqual({ label: "Master" });
    expect(trail[1]).toMatchObject({ icon: "divisions", current: true });
    expect(trail[1]?.href).toBeUndefined();
  });

  it("adds the new record's noun on the new form, with the list as a link", () => {
    const trail = trailFor("/master/divisions/new");

    expect(labels(trail)).toEqual(["Master", "Divisions", "New division"]);
    expect(trail[1]?.href).toBe("/master/divisions");
    expect(trail[2]?.current).toBe(true);
  });

  it("names the record from its page's data, with its tile", () => {
    const trail = trailFor("/master/divisions/d-1", finance);

    expect(labels(trail)).toEqual(["Master", "Divisions", "Finance"]);
    expect(trail[2]).toMatchObject({ tile: finance.tile, current: true });
  });

  it("ends an edit trail on Edit, with the record as a link", () => {
    const trail = trailFor("/master/divisions/d-1/edit", finance);

    expect(labels(trail)).toEqual(["Master", "Divisions", "Finance", "Edit"]);
    expect(trail[2]?.href).toBe("/master/divisions/d-1");
    expect(trail[3]).toMatchObject({ current: true });
  });

  it("makes every crumb before the last a link, but the group", () => {
    const trail = trailFor("/master/divisions/d-1/edit", finance);

    expect(trail.map((crumb) => crumb.href !== undefined)).toEqual([false, true, true, false]);
    expect(trail.filter((crumb) => crumb.current)).toHaveLength(1);
  });

  it("keeps the section crumb, and only it, for a phone", () => {
    const trail = trailFor("/master/divisions/d-1/edit", finance);

    expect(trail.filter((crumb) => crumb.section).map((crumb) => crumb.label)).toEqual([
      "Divisions"
    ]);
  });

  it("shows the dashboard as a single crumb, not under its group", () => {
    expect(trailFor("/")).toEqual([
      { label: "Dashboard", icon: "dashboard", section: true, current: true }
    ]);
  });

  it("stops at the section when a record's page has no record, as on an error page", () => {
    expect(labels(trailFor("/master/divisions/missing"))).toEqual(["Master", "Divisions"]);
    expect(labels(trailFor("/master/divisions/missing/edit"))).toEqual(["Master", "Divisions"]);
  });

  it("has no trail for a path no menu item owns", () => {
    expect(trailFor("/nowhere")).toEqual([]);
  });

  it("gives a menu item added to nav.ts a trail with no other change", () => {
    const groups: NavGroup[] = [
      {
        label: "Warehouse",
        items: [{ label: "Items", noun: "item", href: "/master/users", icon: "users" }]
      }
    ];

    expect(labels(trailFor("/master/users", undefined, groups))).toEqual(["Warehouse", "Items"]);
    expect(labels(trailFor("/master/users/new", undefined, groups))).toEqual([
      "Warehouse",
      "Items",
      "New item"
    ]);
    expect(trailFor("/master/users", undefined, groups)[1]?.icon).toBe("users");
  });
});
