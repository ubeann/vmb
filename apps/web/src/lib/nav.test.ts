import { describe, expect, it } from "vitest";
import { isCurrent, NAV_GROUPS, visibleGroups, type NavItem } from "./nav.js";

describe("isCurrent", () => {
  it("matches the dashboard on the root path only", () => {
    expect(isCurrent("/", "/")).toBe(true);
    expect(isCurrent("/master/users", "/")).toBe(false);
  });

  it("matches a section on its own path and everything beneath it", () => {
    expect(isCurrent("/master/users", "/master/users")).toBe(true);
    expect(isCurrent("/master/users/new", "/master/users")).toBe(true);
    expect(isCurrent("/master/users/3f2/edit", "/master/users")).toBe(true);
  });

  it("does not match a sibling that shares a prefix", () => {
    expect(isCurrent("/master/users-archive", "/master/users")).toBe(false);
    expect(isCurrent("/master/divisions", "/master/users")).toBe(false);
  });
});

describe("visibleGroups", () => {
  it("shows every item until a permission model says otherwise", () => {
    expect(visibleGroups(NAV_GROUPS)).toEqual(NAV_GROUPS);
  });

  it("keeps only the items the check allows, and drops a group left empty", () => {
    const groups = visibleGroups(NAV_GROUPS, (item: NavItem) => item.href === "/master/roles");

    expect(groups.map((group) => group.items.map((item) => item.href))).toEqual([
      ["/master/roles"]
    ]);
  });
});

describe("NAV_GROUPS", () => {
  it("opens with the dashboard and lists the master screens", () => {
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

    expect(hrefs).toEqual(["/", "/master/divisions", "/master/roles", "/master/users"]);
  });
});
