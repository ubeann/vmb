import { withApiClient } from "$lib/api-access.js";
import { deleteDivision, listDivisions, restoreDivision } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { canonicalListSearch, parseListQuery } from "$lib/master/list.js";
import { DEFAULT_TIME_ZONE, DivisionListQuerySchema, resolveDateFilter, todayIn } from "@vmb/types";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

// The zone a date filter's days are read in: everyone's until each user has their own (#115)
const READER_TIME_ZONE = DEFAULT_TIME_ZONE;

export const load: PageServerLoad = async (event) => {
  const parsed = parseListQuery(DivisionListQuerySchema, event.url);
  // `include` (live and Trashed rows together) backs no view: the tabs offer All or Trash
  const query = parsed.trashed === "include" ? { ...parsed, trashed: "exclude" as const } : parsed;
  const search = canonicalListSearch(DivisionListQuerySchema, event.url, query);
  if (search !== event.url.search) redirect(307, `${event.url.pathname}${search}`);
  // the URL keeps a date preset, so a link stays relative; the API gets the days it means today
  const today = todayIn(READER_TIME_ZONE);
  const request = {
    ...query,
    updated: resolveDateFilter(query.updated, today),
    created: resolveDateFilter(query.created, today),
    tz: READER_TIME_ZONE
  };
  const access = await withApiClient(event, (client) => listDivisions(client, request));

  if (!access.ok) {
    console.error("divisions list: failed to reach the API", access.error);
    return { query, divisions: null, trashCount: null };
  }

  const list = access.value;
  if (!list.ok) {
    if (list.status === 403) error(403, list.error);
    console.error("divisions list: API refused the request", list.error);
    return { query, divisions: null, trashCount: null };
  }

  // the Trash tab counts what the search and filters match there (ADR-0051 rule 2)
  return { query, divisions: list.value, trashCount: list.value.views.trash };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "division delete",
      run: (client, id) => deleteDivision(client, id)
    }),
  restore: (event) =>
    runRowAction(event, {
      logLabel: "division restore",
      run: (client, id) => restoreDivision(client, id)
    })
};
