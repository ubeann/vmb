import { withApiClient } from "$lib/api-access.js";
import { getUser, updateUser, pageErrorStatus } from "$lib/master/api.js";
import { userFormData } from "$lib/master/form-data.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { loadRoleOptions, mergeRoles } from "$lib/master/loads.js";
import { UserUpdateInputSchema } from "@vmb/types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const options = loadRoleOptions(event);
  const access = await withApiClient(event, (client) => getUser(client, event.params.id));

  if (!access.ok) {
    console.error("user edit: failed to reach the API", access.error);
    error(500, "Could not load this user. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }

  return {
    user: access.value.value,
    crumb: { label: access.value.value.name },
    form: await superValidate(userFormData(access.value.value), zod4(UserUpdateInputSchema)),
    // the options, plus any role the user holds that the list did not return
    roles: mergeRoles(await options, access.value.value.roles)
  };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: UserUpdateInputSchema,
    logLabel: "user update",
    submit: (client, data, event) => updateUser(client, event.params.id ?? "", data),
    redirectTo: (user) => `/master/users/${user.id}`
  })
};
