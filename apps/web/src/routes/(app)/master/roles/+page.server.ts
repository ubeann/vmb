import { withApiClient } from "$lib/api-access.js";
import { deleteRole, listRoles } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { canonicalListSearch, isCanonicalListSearch, parseListQuery } from "$lib/master/list.js";
import { DEFAULT_TIME_ZONE, RoleListQuerySchema, resolveDateFilter, todayIn } from "@vmb/types";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

// The zone a date filter's days are read in: everyone's until each user has their own (#115)
const READER_TIME_ZONE = DEFAULT_TIME_ZONE;

export const load: PageServerLoad = async (event) => {
  const query = parseListQuery(RoleListQuerySchema, event.url);
  const search = canonicalListSearch(RoleListQuerySchema, event.url, query);
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
      listRoles(client, request),
      // What the list holds before the search and filters, for "n of m roles" (ADR-0051 rule
      // 5); only its `total` is read, so the smallest page size keeps it cheap. It is
      // optional, so a failure here must not take the list down with it.
      filtered
        ? listRoles(client, {
            ...RoleListQuerySchema.parse({ perPage: "10" }),
            tz: READER_TIME_ZONE
          }).catch((error: unknown) => ({ ok: false as const, error }))
        : null
    ])
  );

  if (!access.ok) {
    console.error("roles list: failed to reach the API", access.error);
    return { query, roles: null, outOf: null };
  }

  const [list, unfiltered] = access.value;
  if (!list.ok) {
    if (list.status === 403) error(403, list.error);
    console.error("roles list: API refused the request", list.error);
    return { query, roles: null, outOf: null };
  }
  if (unfiltered && !unfiltered.ok)
    console.error("roles list: could not count the unfiltered list", unfiltered.error);

  return {
    query,
    roles: list.value,
    outOf: unfiltered?.ok ? unfiltered.value.total : null
  };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "role delete",
      run: (client, id) => deleteRole(client, id)
    })
};
