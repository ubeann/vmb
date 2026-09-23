import { createRole } from "$lib/master/api.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { RoleInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod4(RoleInputSchema), { errors: false });
  form.data.isActive = true;
  return { form };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: RoleInputSchema,
    logLabel: "role create",
    submit: (client, data) => createRole(client, data),
    redirectTo: (role) => `/master/roles/${role.id}`
  })
};
