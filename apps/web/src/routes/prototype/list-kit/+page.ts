// PROTOTYPE (prototype/list-kit): the Divisions list load, run over fixtures in the browser, so
// every variant searches, filters, sorts and pages through the URL as the real list does.
import { parseListQuery } from "$lib/master/list.js";
import { DivisionListQuerySchema, type Division, type PermissionKey } from "@vmb/types";
import { DIVISIONS } from "./fixtures.js";
import type { PageLoad } from "./$types.js";

export const load: PageLoad = ({ url }) => {
  const query = parseListQuery(DivisionListQuerySchema, url);
  // a second and third filter, prototype only: date presets, measured from the fixtures' "now",
  // 8 Jan 2026
  const updated = url.searchParams.get("updated");
  const created = url.searchParams.get("created");
  const SINCE: Record<string, string> = {
    today: "2026-01-08",
    week: "2026-01-02",
    month: "2026-01-01"
  };
  const since = (iso: string | null, preset: string | null) =>
    !preset || !SINCE[preset] || (iso ?? "") >= SINCE[preset];

  const term = query.search?.toLowerCase() ?? "";
  // every condition but the view, so the All and Trash tabs can count what matches in each
  const matching = DIVISIONS.filter(
    (d) => query.status === "all" || d.isActive === (query.status === "active")
  )
    .filter(
      (d) =>
        !term ||
        [d.name, d.code, d.description ?? ""].some((field) => field.toLowerCase().includes(term))
    )
    .filter((d) => since(d.updatedAt, updated))
    .filter((d) => since(d.createdAt, created));
  const rows = matching.filter((d) => (query.trashed === "only" ? d.deletedAt : !d.deletedAt));

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
