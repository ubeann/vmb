import { createDivision } from "$lib/master/api.js";
import { createMasterFormAction } from "$lib/master/form-action.js";
import { requirePermission } from "$lib/master/permissions.js";
import { DivisionInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  await requirePermission(event, "master-divisions.create");
  const form = await superValidate(zod4(DivisionInputSchema), { errors: false });
  // The legacy form's toggle starts on; `defaults()` cannot set it because the
  // checkbox's schema input is `unknown`.
  form.data.isActive = true;
  return { form };
};

export const actions: Actions = {
  default: createMasterFormAction({
    schema: DivisionInputSchema,
    logLabel: "division create",
    submit: (client, data) => createDivision(client, data),
    redirectTo: (division) => `/master/divisions/${division.id}`
  })
};
