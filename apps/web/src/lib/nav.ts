// The app shell's navigation (#167). Only screens that exist are listed; the
// warehouse, trucking and expense groups join as their CRUD lands.

import type { PermissionKey } from "@vmb/types";

export type NavIcon = "dashboard" | "divisions" | "roles" | "users";

export type NavItem = {
  label: string;
  // The item's singular, lowercase, for the trail's "New division".
  noun: string;
  href: "/" | "/master/divisions" | "/master/roles" | "/master/users";
  icon: NavIcon;
  // The key that opens the item's list (`*.view_any`); an item with none is for everyone.
  permission?: PermissionKey;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", noun: "dashboard", href: "/", icon: "dashboard" }]
  },
  {
    label: "Master",
    items: [
      {
        label: "Divisions",
        noun: "division",
        href: "/master/divisions",
        icon: "divisions",
        permission: "master-divisions.view_any"
      },
      {
        label: "Roles",
        noun: "role",
        href: "/master/roles",
        icon: "roles",
        permission: "master-roles.view_any"
      },
      {
        label: "Users",
        noun: "user",
        href: "/master/users",
        icon: "users",
        permission: "master-users.view_any"
      }
    ]
  }
];

// The dashboard owns only `/`; every other item owns its path and the screens
// beneath it (a record's page, its edit form).
export function isCurrent(pathname: string, href: NavItem["href"]): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Keeps the groups with an item the check allows. The shell passes `canOpen`, so
// the sidebar offers only what the API would let the caller list (#464).
export function visibleGroups(
  groups: NavGroup[],
  canView: (item: NavItem) => boolean = () => true
): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter(canView) }))
    .filter((group) => group.items.length > 0);
}

// The check for a caller holding `permissions`: an item is theirs when it asks for no key,
// or for one they hold.
export function canOpen(permissions: readonly string[]) {
  return (item: NavItem) => item.permission === undefined || permissions.includes(item.permission);
}

// Where `/master` leads a caller: the first Master list they may open, in the menu's order,
// or none when they may open none.
export function firstMasterScreen(permissions: readonly string[]): NavItem["href"] | null {
  const master = NAV_GROUPS.find((group) => group.label === "Master");
  return master?.items.find(canOpen(permissions))?.href ?? null;
}
