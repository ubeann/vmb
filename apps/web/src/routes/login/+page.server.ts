import { withAuthApiClient } from "$lib/api-access.js";
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

    const access = await withAuthApiClient(event, (client) =>
      client.signIn.email({ email, password })
    );

    if (!access.ok) {
      console.error("login action: request to API failed", access.error);
      return fail(500, { error: "Something went wrong. Please try again." });
    }

    if (access.value.error) {
      return fail(400, { error: access.value.error.message ?? "Invalid email or password." });
    }

    redirect(303, "/");
  }
};
