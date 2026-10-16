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

  const role = access.value.value;
  return {
    role,
    // without JavaScript, Delete… asks on the page itself before the form posts
    confirmDelete: event.url.searchParams.has("delete"),
    crumb: { label: role.name, tile: { iconName: role.iconName, colorHex: role.colorHex } }
  };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "role delete",
      run: (client, id) => deleteRole(client, id),
      onSuccess: () => redirect(303, "/master/roles")
    })
};
