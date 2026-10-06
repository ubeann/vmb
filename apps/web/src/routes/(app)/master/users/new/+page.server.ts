import { createUser } from "$lib/master/api.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { loadRoleOptions } from "$lib/master/loads.js";
import { UserCreateInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => ({
  form: await superValidate(zod4(UserCreateInputSchema)),
  roles: await loadRoleOptions(event)
});

export const actions: Actions = {
  default: createMasterFormAction({
    schema: UserCreateInputSchema,
    logLabel: "user create",
    submit: (client, data) => createUser(client, data),
    redirectTo: (user) => `/master/users/${user.id}`
  })
};
