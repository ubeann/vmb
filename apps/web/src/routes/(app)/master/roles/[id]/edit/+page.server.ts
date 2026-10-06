import { withApiClient } from "$lib/api-access.js";
import { getRole, updateRole, pageErrorStatus } from "$lib/master/api.js";
import { roleFormData } from "$lib/master/form-data.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { RoleInputSchema } from "@vmb/types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const access = await withApiClient(event, (client) => getRole(client, event.params.id));

  if (!access.ok) {
    console.error("role edit: failed to reach the API", access.error);
    error(500, "Could not load this role. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }

  return {
    role: access.value.value,
    form: await superValidate(roleFormData(access.value.value), zod4(RoleInputSchema))
  };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: RoleInputSchema,
    logLabel: "role update",
    submit: (client, data, event) => updateRole(client, event.params.id ?? "", data),
    redirectTo: (role) => `/master/roles/${role.id}`
  })
};
