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

    let result: Awaited<ReturnType<ReturnType<typeof createAuthApiClient>["signUp"]["email"]>>;
    try {
      const client = createAuthApiClient(resolveApiUrl(event.platform), event.fetch);
      result = await client.signUp.email({
        name,
        email,
        password,
        // Absolute URL required: Better Auth's verify-email link is opened
        // directly from the user's inbox (hitting apps/api's own origin),
        // and this is checked against trustedOrigins before it's honored.
        // Without it, the link would redirect back to apps/api itself,
        // which has no "/" route.
        callbackURL: `${event.url.origin}/login?verified=true`
      });
    } catch (err) {
      console.error("signup action: request to API failed", err);
      return fail(500, { error: "Something went wrong. Please try again." });
    }

    if (result.error) {
      return fail(400, { error: result.error.message ?? "Could not create account." });
    }

    // requireEmailVerification is on: signUp.email succeeding here does NOT
    // create a session (no Set-Cookie) — the user still needs to click the
    // verification link, then log in normally. Don't redirect to "/" as if
    // they're already signed in.
    return { success: true };
  }
};
