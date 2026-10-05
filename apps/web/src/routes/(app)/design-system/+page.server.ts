import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { DemoSchema } from "./schema.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
  return { form: await superValidate(zod4(DemoSchema), { errors: false }) };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod4(DemoSchema));
    if (!form.valid) return fail(400, { form });
    return message(form, `Saved ${form.data.name} (${form.data.code})`);
  }
};
