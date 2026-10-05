import { withApiClient } from "$lib/api-access.js";
import { deleteUser, listUsers, restoreUser } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { parseListQuery } from "$lib/master/list.js";
import { loadDivisionOptions } from "$lib/master/loads.js";
import { UserListQuerySchema } from "@vmb/types";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const query = parseListQuery(UserListQuerySchema, event.url);
  const divisions = loadDivisionOptions(event);

  const access = await withApiClient(event, (client) => listUsers(client, query));

  if (!access.ok) {
    console.error("users list: failed to reach the API", access.error);
    return { query, users: null, divisions: await divisions };
  }
  if (!access.value.ok) {
    console.error("users list: API refused the request", access.value.error);
    return { query, users: null, divisions: await divisions };
  }

  return { query, users: access.value.value, divisions: await divisions };
};

export const actions: Actions = {
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
