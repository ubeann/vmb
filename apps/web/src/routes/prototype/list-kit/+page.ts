// PROTOTYPE (prototype/list-kit): the Divisions list load, run over fixtures in the browser, so
// every variant searches, filters, sorts and pages through the URL as the real list does.
import { parseListQuery } from "$lib/master/list.js";
import { DivisionListQuerySchema, type Division, type PermissionKey } from "@vmb/types";
import { PRESET_RANGE, within } from "./dates.js";
import { DIVISIONS } from "./fixtures.js";
import type { PageLoad } from "./$types.js";

export const load: PageLoad = ({ url }) => {
  const query = parseListQuery(DivisionListQuerySchema, url);
  // Round 5: status takes several values (`status=active,inactive`, Q12), so it is read here
  // rather than through the schema's single enum; the dates are prototype-only filters
  const status = (url.searchParams.get("status") ?? "")
    .split(",")
    .filter((v) => v === "active" || v === "inactive");
  const updated = url.searchParams.get("updated");
  const created = url.searchParams.get("created");

  const term = query.search?.toLowerCase() ?? "";
  const inView = (d: Division) => (query.trashed === "only" ? Boolean(d.deletedAt) : !d.deletedAt);
  const conditions = {
    search: (d: Division) =>
      !term ||
      [d.name, d.code, d.description ?? ""].some((field) => field.toLowerCase().includes(term)),
    status: (d: Division) =>
      status.length === 0 || status.includes(d.isActive ? "active" : "inactive"),
    updated: (d: Division) => within(d.updatedAt, updated),
    created: (d: Division) => within(d.createdAt, created)
  };
  type Key = keyof typeof conditions;
  const matches = (d: Division, except?: Key) =>
    (Object.keys(conditions) as Key[]).every((key) => key === except || conditions[key](d));

  // every condition but the view, so the All and Trash tabs can count what matches in each
  const matching = DIVISIONS.filter((d) => matches(d));
  const rows = matching.filter(inView);

  // Round 5: an option's count is what the list would hold with that option alone chosen,
  // every other condition and the view kept
  const others = (except: Key) => DIVISIONS.filter((d) => inView(d) && matches(d, except));
  const countDates = (key: "updated" | "created", field: "updatedAt" | "createdAt") =>
    Object.fromEntries(
      Object.keys(PRESET_RANGE).map((preset) => [
        preset,
        others(key).filter((d) => within(d[field], preset)).length
      ])
    );
  const facets: Record<string, Record<string, number>> = {
    status: {
      active: others("status").filter((d) => d.isActive).length,
      inactive: others("status").filter((d) => !d.isActive).length
    },
    updated: countDates("updated", "updatedAt"),
    created: countDates("created", "createdAt")
  };

  const key = query.sort as keyof Division;
  rows.sort(
    (a, b) => String(a[key]).localeCompare(String(b[key])) * (query.dir === "asc" ? 1 : -1)
  );

  const start = (query.page - 1) * query.perPage;
  const permissions: PermissionKey[] = [
    "master-divisions.create",
    "master-divisions.update",
    "master-divisions.delete",
    "master-divisions.restore"
  ] as PermissionKey[];

  return {
    query,
    extra: { updated, created },
    divisions: {
      items: rows.slice(start, start + query.perPage),
      total: rows.length,
      page: query.page,
      perPage: query.perPage
    },
    facets,
    // Round 4: the tabs count what matches the search and filters in each view
    views: {
      all: matching.filter((d) => !d.deletedAt).length,
      trash: matching.filter((d) => d.deletedAt).length
    },
    // like the real list, these ignore search and filters ("n of m divisions")
    trashCount: DIVISIONS.filter((d) => d.deletedAt).length,
    allCount: DIVISIONS.filter((d) => !d.deletedAt).length,
    permissions
  };
};
