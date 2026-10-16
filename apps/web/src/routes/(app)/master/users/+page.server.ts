import { withApiClient } from "$lib/api-access.js";
import { bulkUsers, deleteUser, listUsers, restoreUser } from "$lib/master/api.js";
import { runBulkAction, runRowAction } from "$lib/master/form-action.js";
import { canonicalListSearch, isCanonicalListSearch, parseListQuery } from "$lib/master/list.js";
import { loadDivisionOptions } from "$lib/master/loads.js";
import { DEFAULT_TIME_ZONE, UserListQuerySchema, resolveDateFilter, todayIn } from "@vmb/types";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

// The zone a date filter's days are read in: everyone's until each user has their own (#115)
const READER_TIME_ZONE = DEFAULT_TIME_ZONE;

export const load: PageServerLoad = async (event) => {
  const parsed = parseListQuery(UserListQuerySchema, event.url);
  // `include` (live and Trashed rows together) backs no view: the tabs offer All or Trash
  const query = parsed.trashed === "include" ? { ...parsed, trashed: "exclude" as const } : parsed;
  const search = canonicalListSearch(UserListQuerySchema, event.url, query);
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
    Boolean(query.search || query.updated || query.created) ||
    query.status.length > 0 ||
    query.division.length > 0;
  const divisions = loadDivisionOptions(event);
  const access = await withApiClient(event, (client) =>
    Promise.all([
      listUsers(client, request),
      // What the view holds before the search and filters, for "n of m users" (ADR-0051
      // rule 5); only its `total` is read, so the smallest page size keeps it cheap. It is
      // optional, so a failure here must not take the list down with it.
      filtered
        ? listUsers(client, {
            ...UserListQuerySchema.parse({ trashed: query.trashed, perPage: "10" }),
            tz: READER_TIME_ZONE
          }).catch((error: unknown) => ({ ok: false as const, error }))
        : null
    ])
  );

  if (!access.ok) {
    console.error("users list: failed to reach the API", access.error);
    return { query, users: null, trashCount: null, outOf: null, divisions: await divisions };
  }

  const [list, unfiltered] = access.value;
  if (!list.ok) {
    if (list.status === 403) error(403, list.error);
    console.error("users list: API refused the request", list.error);
    return { query, users: null, trashCount: null, outOf: null, divisions: await divisions };
  }
  if (unfiltered && !unfiltered.ok)
    console.error("users list: could not count the unfiltered view", unfiltered.error);

  return {
    query,
    users: list.value,
    // the Trash tab counts what the search and filters match there (ADR-0051 rule 2)
    trashCount: list.value.views.trash,
    outOf: unfiltered?.ok ? unfiltered.value.total : null,
    // the Division filter's options: a failure leaves the filter with none, not the page without a list
    divisions: await divisions
  };
};

export const actions: Actions = {
  bulk: (event) =>
    runBulkAction(event, {
      logLabel: "user bulk",
      run: (client, request) => bulkUsers(client, request)
    }),
  delete: (event) =>
    runRowAction(event, {
      logLabel: "user delete",
      run: (client, id) => deleteUser(client, id)
    }),
  restore: (event) =>
    runRowAction(event, {
      logLabel: "user restore",
      run: (client, id) => restoreUser(client, id)
    })
};
