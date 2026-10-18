import { withApiClient } from "$lib/api-access.js";
import { getUser, updateUser, pageErrorStatus } from "$lib/master/api.js";
import { userFormData } from "$lib/master/form-data.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { loadRoleOptions, roleChoices } from "$lib/master/loads.js";
import { requirePermission } from "$lib/master/permissions.js";
import { UserUpdateInputSchema } from "@vmb/types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  await requirePermission(event, "master-users.update");
  const options = loadRoleOptions(event);
  const access = await withApiClient(event, (client) => getUser(client, event.params.id));

  if (!access.ok) {
    console.error("user edit: failed to reach the API", access.error);
    error(500, "Could not load this user. Please try again.");
  }
  if (!access.value.ok) {
    error(pageErrorStatus(access.value.status), access.value.error);
  }
  // a Trashed user is read-only until restored (ADR-0055): the API answers an edit of one 404, and so does this
  if (access.value.value.deletedAt) error(404, "User not found.");
  // nor is a user holding permissions the caller lacks theirs to change: the API answers 403
  if (!access.value.value.withinReach) {
    error(403, "You cannot change a user who holds permissions you do not have.");
  }

  return {
    user: access.value.value,
    crumb: { label: access.value.value.name },
    form: await superValidate(userFormData(access.value.value), zod4(UserUpdateInputSchema)),
    // the options, plus any role the user holds that the list did not return, and the
    // roles of an Inactive Division only where the user holds them (the Inactive rule)
    roles: roleChoices(await options, access.value.value.roles)
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
