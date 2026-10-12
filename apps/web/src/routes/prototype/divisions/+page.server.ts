// PROTOTYPE (prototype/divisions): the Divisions list's load and row actions, run over in-memory
// fixtures so every variant searches, filters, sorts, pages and acts as the real list does,
// with no API or sign-in. A server restart puts the fixtures back. Throwaway; never merge.
import { parseListQuery } from "$lib/master/list.js";
import {
  dateFilterRange,
  DEFAULT_TIME_ZONE,
  DivisionListQuerySchema,
  todayIn,
  type Division,
  type DivisionListResponse,
  type PermissionKey
} from "@vmb/types";
import { fail, type RequestEvent } from "@sveltejs/kit";
import { DIVISIONS, MANY_DIVISIONS, TODAY } from "./fixtures.js";
import type { Actions, PageServerLoad } from "./$types.js";

// `?data=many` swaps in ~240 divisions to see paging
const SETS = { few: structuredClone(DIVISIONS), many: structuredClone(MANY_DIVISIONS) };
const setOf = (url: URL) => SETS[url.searchParams.get("data") === "many" ? "many" : "few"];

const PERMISSIONS = [
  "master-divisions.create",
  "master-divisions.update",
  "master-divisions.delete",
  "master-divisions.restore"
] as PermissionKey[];

const dayOf = (iso: string | null) => (iso ? todayIn(DEFAULT_TIME_ZONE, new Date(iso)) : "");

export const load: PageServerLoad = ({ url }) => {
  const parsed = parseListQuery(DivisionListQuerySchema, url);
  const query = parsed.trashed === "include" ? { ...parsed, trashed: "exclude" as const } : parsed;
  const all = setOf(url);

  const term = query.search?.toLowerCase() ?? "";
  const within = (iso: string | null, value: string | undefined) => {
    const range = dateFilterRange(value, TODAY);
    if (!range) return true;
    const day = dayOf(iso);
    return day >= range.from && day <= range.to;
  };
  const conditions = {
    search: (d: Division) =>
      !term || [d.name, d.code, d.description ?? ""].some((f) => f.toLowerCase().includes(term)),
    status: (d: Division) =>
      query.status.length === 0 || query.status.includes(d.isActive ? "active" : "inactive"),
    updated: (d: Division) => within(d.updatedAt, query.updated),
    created: (d: Division) => within(d.createdAt, query.created)
  };
  type Key = keyof typeof conditions;
  const matches = (d: Division, except?: Key) =>
    (Object.keys(conditions) as Key[]).every((key) => key === except || conditions[key](d));
  const inView = (d: Division) => (query.trashed === "only" ? Boolean(d.deletedAt) : !d.deletedAt);

  const matching = all.filter((d) => matches(d));
  const rows = matching.filter(inView);
  const withoutStatus = all.filter((d) => inView(d) && matches(d, "status"));

  const key = query.sort;
  rows.sort(
    (a, b) =>
      String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * (query.dir === "asc" ? 1 : -1)
  );
  const start = (query.page - 1) * query.perPage;

  const divisions: DivisionListResponse = {
    items: rows.slice(start, start + query.perPage),
    total: rows.length,
    page: query.page,
    perPage: query.perPage,
    views: {
      all: matching.filter((d) => !d.deletedAt).length,
      trash: matching.filter((d) => d.deletedAt).length
    },
    facets: {
      status: {
        active: withoutStatus.filter((d) => d.isActive).length,
        inactive: withoutStatus.filter((d) => !d.isActive).length
      }
    }
  };
  const filtered =
    Boolean(query.search || query.updated || query.created) || query.status.length > 0;

  return {
    query,
    divisions,
    trashCount: divisions.views.trash,
    outOf: filtered ? all.filter(inView).length : null,
    permissions: PERMISSIONS
  };
};

async function act(event: RequestEvent, change: (d: Division) => void) {
  const id = String((await event.request.formData()).get("id") ?? "");
  const division = setOf(event.url).find((d) => d.id === id);
  if (!division) return fail(404, { error: "That division no longer exists." });
  change(division);
  division.updatedAt = new Date().toISOString();
  return { ok: true };
}

export const actions: Actions = {
  delete: (event) => act(event, (d) => (d.deletedAt = new Date().toISOString())),
  activate: (event) => act(event, (d) => (d.isActive = true)),
  deactivate: (event) => act(event, (d) => (d.isActive = false)),
  restore: (event) => act(event, (d) => (d.deletedAt = null))
};
