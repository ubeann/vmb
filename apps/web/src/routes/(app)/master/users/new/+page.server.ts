import { createUser } from "$lib/master/api.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { loadRoleOptions, roleChoices } from "$lib/master/loads.js";
import { requirePermission } from "$lib/master/permissions.js";
import { UserCreateInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  await requirePermission(event, "master-users.create");
  return {
    form: await superValidate(zod4(UserCreateInputSchema), { errors: false }),
    // nobody holds the roles yet, so those of an Inactive Division are not offered
    roles: roleChoices(await loadRoleOptions(event), [])
  };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: UserCreateInputSchema,
    logLabel: "user create",
    submit: (client, data) => createUser(client, data),
    redirectTo: (user) => `/master/users/${user.id}`
  })
};
