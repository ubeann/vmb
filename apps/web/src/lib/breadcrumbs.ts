// The top bar's trail (#349, ADR-0050 rule 5). The group and item labels, the item's icon
// and the noun for "New division" come from `nav.ts`, so a new menu item gets a trail
// with no other change; a record's crumb comes from its page's data (`PageData.crumb`).

import { isCurrent, NAV_GROUPS, type NavGroup, type NavIcon } from "./nav.js";

/** A record's own identity: its name, and the tile a Division shows beside it. */
export type RecordCrumb = {
  label: string;
  tile?: { iconName: string; colorHex: string };
};

export type Crumb = {
  label: string;
  // Absent on the group, which has no page of its own, and on the current page.
  href?: string;
  icon?: NavIcon;
  tile?: RecordCrumb["tile"];
  // The one crumb a phone keeps: the screen's section.
  section?: boolean;
  current?: boolean;
};

export function trailFor(
  pathname: string,
  record?: RecordCrumb,
  groups: NavGroup[] = NAV_GROUPS
): Crumb[] {
  for (const group of groups) {
    for (const item of group.items) {
      if (!isCurrent(pathname, item.href)) continue;

      const section: Crumb = { label: item.label, icon: item.icon, section: true };
      // The dashboard is a screen of its own, not a member of its "Overview" group.
      if (item.href === "/") return [{ ...section, current: true }];

      const rest = pathname.slice(item.href.length).split("/").filter(Boolean);
      const [segment, action] = rest;
      const listed = [{ label: group.label }, { ...section, current: true }];
      const linked = [{ label: group.label }, { ...section, href: item.href }];

      if (segment === "new" && rest.length === 1) {
        return [...linked, { label: `New ${item.noun}`, current: true }];
      }
      // A record's page names the record from its data; without it (an error page)
      // the trail stops at the section.
      if (!segment || segment === "new" || !record) return listed;

      const crumb: Crumb = { label: record.label, tile: record.tile };
      if (rest.length === 1) return [...linked, { ...crumb, current: true }];
      if (rest.length === 2 && action === "edit") {
        return [
          ...linked,
          { ...crumb, href: `${item.href}/${segment}` },
          { label: "Edit", current: true }
        ];
      }
      return listed;
    }
  }
  return [];
}
