import { withApiClient } from "$lib/api-access.js";
import {
  bulkDivisions,
  deleteDivision,
  listDivisions,
  restoreDivision,
  setDivisionActive
} from "$lib/master/api.js";
import { runBulkAction, runRowAction } from "$lib/master/form-action.js";
import { canonicalListSearch, isCanonicalListSearch, parseListQuery } from "$lib/master/list.js";
import {
  DEFAULT_TIME_ZONE,
  DivisionBulkRequestSchema,
  DivisionListQuerySchema,
  resolveDateFilter,
  todayIn
} from "@vmb/types";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

// The zone a date filter's days are read in: everyone's until each user has their own (#115)
const READER_TIME_ZONE = DEFAULT_TIME_ZONE;

export const load: PageServerLoad = async (event) => {
  const parsed = parseListQuery(DivisionListQuerySchema, event.url);
  // `include` (live and Trashed rows together) backs no view: the tabs offer All or Trash
  const query = parsed.trashed === "include" ? { ...parsed, trashed: "exclude" as const } : parsed;
  const search = canonicalListSearch(DivisionListQuerySchema, event.url, query);
  if (!isCanonicalListSearch(event.url, search)) redirect(307, `${event.url.pathname}${search}`);
  // the URL keeps a date preset, so a link stays relative; the API gets the days it means today
  const today = todayIn(READER_TIME_ZONE);
  const request = {
    ...query,
    updated: resolveDateFilter(query.updated, today),
    created: resolveDateFilter(query.created, today),
    tz: READER_TIME_ZONE
  };
  const filtered =
    Boolean(query.search || query.updated || query.created) || query.status.length > 0;
  const access = await withApiClient(event, (client) =>
    Promise.all([
      listDivisions(client, request),
      // What the view holds before the search and filters, for "n of m divisions" (ADR-0051
      // rule 5); only its `total` is read, so the smallest page size keeps it cheap. It is
      // optional, so a failure here must not take the list down with it.
      filtered
        ? listDivisions(client, {
            ...DivisionListQuerySchema.parse({ trashed: query.trashed, perPage: "10" }),
            tz: READER_TIME_ZONE
          }).catch((error: unknown) => ({ ok: false as const, error }))
        : null
    ])
  );

  if (!access.ok) {
    console.error("divisions list: failed to reach the API", access.error);
    return { query, divisions: null, trashCount: null, outOf: null };
  }

  const [list, unfiltered] = access.value;
  if (!list.ok) {
    if (list.status === 403) error(403, list.error);
    console.error("divisions list: API refused the request", list.error);
    return { query, divisions: null, trashCount: null, outOf: null };
  }
  if (unfiltered && !unfiltered.ok)
    console.error("divisions list: could not count the unfiltered view", unfiltered.error);

  return {
    query,
    divisions: list.value,
    // the Trash tab counts what the search and filters match there (ADR-0051 rule 2)
    trashCount: list.value.views.trash,
    outOf: unfiltered?.ok ? unfiltered.value.total : null
  };
};

export const actions: Actions = {
  bulk: (event) =>
    runBulkAction(event, {
      logLabel: "division bulk",
      schema: DivisionBulkRequestSchema,
      run: (client, request) => bulkDivisions(client, request)
    }),
  delete: (event) =>
    runRowAction(event, {
      logLabel: "division delete",
      run: (client, id) => deleteDivision(client, id)
    }),
  activate: (event) =>
    runRowAction(event, {
      logLabel: "division activate",
      run: (client, id) => setDivisionActive(client, id, true)
    }),
  deactivate: (event) =>
    runRowAction(event, {
      logLabel: "division deactivate",
      run: (client, id) => setDivisionActive(client, id, false)
    }),
  restore: (event) =>
    runRowAction(event, {
      logLabel: "division restore",
      run: (client, id) => restoreDivision(client, id)
    })
};
