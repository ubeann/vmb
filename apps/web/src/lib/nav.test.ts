import { describe, expect, it } from "vitest";
import {
  canOpen,
  firstMasterScreen,
  isCurrent,
  NAV_GROUPS,
  visibleGroups,
  type NavItem
} from "./nav.js";

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
  it("shows every item when no check is given", () => {
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

describe("the sidebar's permission filter", () => {
  const hrefs = (permissions: string[]) =>
    visibleGroups(NAV_GROUPS, canOpen(permissions)).flatMap((group) =>
      group.items.map((item) => item.href)
    );

  it("asks each Master list for its own view_any key, and the dashboard for none", () => {
    const keys = Object.fromEntries(
      NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.href, item.permission]))
    );

    expect(keys).toEqual({
      "/": undefined,
      "/master/divisions": "master-divisions.view_any",
      "/master/roles": "master-roles.view_any",
      "/master/users": "master-users.view_any"
    });
  });

  it("offers a caller with no permission the dashboard alone, and drops the Master group", () => {
    expect(hrefs([])).toEqual(["/"]);
    expect(visibleGroups(NAV_GROUPS, canOpen([])).map((group) => group.label)).toEqual([
      "Overview"
    ]);
  });

  it("offers each Master list to a holder of its key only", () => {
    expect(hrefs(["master-roles.view_any"])).toEqual(["/", "/master/roles"]);
    expect(hrefs(["master-users.view_any", "master-divisions.view_any"])).toEqual([
      "/",
      "/master/divisions",
      "/master/users"
    ]);
  });

  it("does not take a single-record view for the list", () => {
    expect(hrefs(["master-users.view", "master-roles.view"])).toEqual(["/"]);
  });
});

describe("firstMasterScreen", () => {
  it("is the first Master list the caller may open, in the menu's order", () => {
    expect(firstMasterScreen(["master-users.view_any", "master-roles.view_any"])).toBe(
      "/master/roles"
    );
    expect(firstMasterScreen(["master-users.view_any"])).toBe("/master/users");
    expect(firstMasterScreen(["master-divisions.view_any", "master-users.view_any"])).toBe(
      "/master/divisions"
    );
  });

  it("is none when the caller may open no Master list", () => {
    expect(firstMasterScreen([])).toBeNull();
    expect(firstMasterScreen(["master-users.view", "master-users.create"])).toBeNull();
  });
});
