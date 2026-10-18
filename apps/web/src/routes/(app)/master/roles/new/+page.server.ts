import { createRole } from "$lib/master/api.js";
import { DEFAULT_COLOR } from "$lib/master/appearance.js";
import { RoleFormSchema } from "$lib/master/form-data.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { divisionChoices, loadDivisionOptions } from "$lib/master/loads.js";
import { requirePermission } from "$lib/master/permissions.js";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  await requirePermission(event, "master-roles.create");
  const form = await superValidate(zod4(RoleFormSchema), { errors: false });
  // The legacy form's toggle starts on; `defaults()` cannot set it because the
  // checkbox's schema input is `unknown`.
  form.data.isActive = true;
  // the schema's default is black, which the dark theme's tile all but hides
  form.data.colorHex = DEFAULT_COLOR;
  // no Division yet, so one that is Inactive is not offered
  return { form, divisions: divisionChoices(await loadDivisionOptions(event), null) };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: RoleFormSchema,
    logLabel: "role create",
    submit: (client, data) => createRole(client, data),
    redirectTo: (role) => `/master/roles/${role.id}`
  })
};
