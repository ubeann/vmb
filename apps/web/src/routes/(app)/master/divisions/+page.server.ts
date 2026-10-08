import { withApiClient } from "$lib/api-access.js";
import { deleteDivision, listDivisions, restoreDivision } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { canonicalListSearch, parseListQuery } from "$lib/master/list.js";
import { DivisionListQuerySchema } from "@vmb/types";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

// How many Divisions sit in the Trash, for the tab's count. It ignores the
// list's filters, so the count is stable while you search; the smallest page
// size keeps the extra request cheap, since only its `total` is read.
const TRASH_COUNT_QUERY = DivisionListQuerySchema.parse({ trashed: "only", perPage: "10" });

export const load: PageServerLoad = async (event) => {
  const parsed = parseListQuery(DivisionListQuerySchema, event.url);
  // `include` (live and Trashed rows together) backs no view: the tabs offer All or Trash
  const query = parsed.trashed === "include" ? { ...parsed, trashed: "exclude" as const } : parsed;
  const search = canonicalListSearch(DivisionListQuerySchema, event.url, query);
  if (search !== event.url.search) redirect(307, `${event.url.pathname}${search}`);
  const access = await withApiClient(event, (client) =>
    Promise.all([
      listDivisions(client, query),
      // the count is optional, so a transport failure here must not take the list down with it
      listDivisions(client, TRASH_COUNT_QUERY).catch((error: unknown) => ({
        ok: false as const,
        error
      }))
    ])
  );

  if (!access.ok) {
    console.error("divisions list: failed to reach the API", access.error);
    return { query, divisions: null, trashCount: null };
  }

  const [list, trash] = access.value;
  if (!list.ok) {
    if (list.status === 403) error(403, list.error);
    console.error("divisions list: API refused the request", list.error);
    return { query, divisions: null, trashCount: null };
  }
  if (!trash.ok) console.error("divisions list: could not count the Trash", trash.error);

  return { query, divisions: list.value, trashCount: trash.ok ? trash.value.total : null };
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
