import { withApiClient } from "$lib/api-access.js";
import { deleteUser, getUser, restoreUser, pageErrorStatus } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const access = await withApiClient(event, (client) => getUser(client, event.params.id));

  if (!access.ok) {
    console.error("user detail: failed to reach the API", access.error);
    error(500, "Could not load this user. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }

  return { user: access.value.value, crumb: { label: access.value.value.name } };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "user delete",
      run: (client, id) => deleteUser(client, id),
      onSuccess: () => redirect(303, "/master/users")
    }),
  restore: (event) =>
    runRowAction(event, {
      logLabel: "user restore",
      run: (client, id) => restoreUser(client, id)
    })
};
