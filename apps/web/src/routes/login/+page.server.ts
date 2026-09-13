import { createAuthApiClient } from "$lib/auth.js";
import { resolveApiUrl } from "$lib/env.js";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) {
    redirect(303, "/");
  }
};

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const email = form.get("email");
    const password = form.get("password");

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return fail(400, { error: "Email and password are required." });
    }

    const client = createAuthApiClient(resolveApiUrl(event.platform), event.fetch);

    const { error } = await client.signIn.email({ email, password });

    if (error) {
      return fail(400, { error: error.message ?? "Invalid email or password." });
    }

    redirect(303, "/");
  }
};
