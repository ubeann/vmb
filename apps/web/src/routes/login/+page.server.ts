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

    let result: Awaited<ReturnType<ReturnType<typeof createAuthApiClient>["signIn"]["email"]>>;
    try {
      const client = createAuthApiClient(resolveApiUrl(event.platform), event.fetch);
      result = await client.signIn.email({ email, password });
    } catch (err) {
      console.error("login action: request to API failed", err);
      return fail(500, { error: "Something went wrong. Please try again." });
    }

    if (result.error) {
      return fail(400, { error: result.error.message ?? "Invalid email or password." });
    }

    redirect(303, "/");
  }
};
