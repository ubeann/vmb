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
    const name = form.get("name");
    const email = form.get("email");
    const password = form.get("password");

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name ||
      !email ||
      !password
    ) {
      return fail(400, { error: "Name, email, and password are required." });
    }

    const client = createAuthApiClient(resolveApiUrl(event.platform), event.fetch);

    let result: Awaited<ReturnType<typeof client.signUp.email>>;
    try {
      result = await client.signUp.email({ name, email, password });
    } catch (err) {
      console.error("signup action: request to API failed", err);
      return fail(500, { error: "Something went wrong. Please try again." });
    }

    if (result.error) {
      return fail(400, { error: result.error.message ?? "Could not create account." });
    }

    redirect(303, "/");
  }
};
