import { withApiClient } from "$lib/api-access.js";
import { deleteRole, getRole, pageErrorStatus } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const access = await withApiClient(event, (client) => getRole(client, event.params.id));

  if (!access.ok) {
    console.error("role detail: failed to reach the API", access.error);
    error(500, "Could not load this role. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }

  return { role: access.value.value, crumb: { label: access.value.value.name } };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "role delete",
      run: (client, id) => deleteRole(client, id),
      onSuccess: () => redirect(303, "/master/roles")
    })
};
