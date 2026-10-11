import { withApiClient } from "$lib/api-access.js";
import { getDivision, updateDivision, pageErrorStatus } from "$lib/master/api.js";
import { divisionFormData } from "$lib/master/form-data.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { DivisionUpdateInputSchema } from "@vmb/types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const access = await withApiClient(event, (client) => getDivision(client, event.params.id));

  if (!access.ok) {
    console.error("division edit: failed to reach the API", access.error);
    error(500, "Could not load this division. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }

  return {
    division: access.value.value,
    crumb: {
      label: access.value.value.name,
      tile: { iconName: access.value.value.iconName, colorHex: access.value.value.colorHex }
    },
    form: await superValidate(divisionFormData(access.value.value), zod4(DivisionUpdateInputSchema))
  };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: DivisionUpdateInputSchema,
    logLabel: "division update",
    submit: (client, data, event) => updateDivision(client, event.params.id ?? "", data),
    redirectTo: (division) => `/master/divisions/${division.id}`
  })
};
