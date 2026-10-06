import { withApiClient } from "$lib/api-access.js";
import { deleteRole, listRoles } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { parseListQuery } from "$lib/master/list.js";
import { RoleListQuerySchema } from "@vmb/types";
import { error } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const query = parseListQuery(RoleListQuerySchema, event.url);
  const access = await withApiClient(event, (client) => listRoles(client, query));

  if (!access.ok) {
    console.error("roles list: failed to reach the API", access.error);
    return { query, roles: null };
  }
  if (!access.value.ok) {
    if (access.value.status === 403) error(403, access.value.error);
    console.error("roles list: API refused the request", access.value.error);
    return { query, roles: null };
  }

  return { query, roles: access.value.value };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "role delete",
      run: (client, id) => deleteRole(client, id)
    })
};
