// The app shell's navigation (#167). Only screens that exist are listed; the
// warehouse, trucking and expense groups join as their CRUD lands.

export type NavIcon = "dashboard" | "divisions" | "roles" | "users";

export type NavItem = {
  label: string;
  // The item's singular, lowercase, for the trail's "New division".
  noun: string;
  href: "/" | "/master/divisions" | "/master/roles" | "/master/users";
  icon: NavIcon;
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
      { label: "Divisions", noun: "division", href: "/master/divisions", icon: "divisions" },
      { label: "Roles", noun: "role", href: "/master/roles", icon: "roles" },
      { label: "Users", noun: "user", href: "/master/users", icon: "users" }
    ]
  }
];

// The dashboard owns only `/`; every other item owns its path and the screens
// beneath it (a record's page, its edit form).
export function isCurrent(pathname: string, href: NavItem["href"]): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// The seam for #8: the permission model decides which items a user sees by
// passing a check here. Until it lands every item shows, and this file invents
// no permission vocabulary of its own.
export function visibleGroups(
  groups: NavGroup[],
  canView: (item: NavItem) => boolean = () => true
): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter(canView) }))
    .filter((group) => group.items.length > 0);
}
