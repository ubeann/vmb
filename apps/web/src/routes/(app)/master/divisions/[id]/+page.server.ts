import { withApiClient } from "$lib/api-access.js";
import { deleteDivision, getDivision, restoreDivision, pageErrorStatus } from "$lib/master/api.js";
import { runRowAction } from "$lib/master/form-action.js";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const access = await withApiClient(event, (client) => getDivision(client, event.params.id));

  if (!access.ok) {
    console.error("division detail: failed to reach the API", access.error);
    error(500, "Could not load this division. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }

  const division = access.value.value;
  return {
    division,
    crumb: {
      label: division.name,
      tile: { iconName: division.iconName, colorHex: division.colorHex }
    }
  };
};

export const actions: Actions = {
  delete: (event) =>
    runRowAction(event, {
      logLabel: "division delete",
      run: (client, id) => deleteDivision(client, id),
      onSuccess: () => redirect(303, "/master/divisions")
    }),
  restore: (event) =>
    runRowAction(event, {
      logLabel: "division restore",
      run: (client, id) => restoreDivision(client, id)
    })
};
