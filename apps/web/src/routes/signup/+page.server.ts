import { createAuthAction } from "$lib/auth-action.js";
import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) {
    redirect(303, "/");
  }
};

export const actions: Actions = {
  default: createAuthAction({
    fields: ["name", "email", "password"],
    missingFieldsMessage: "Name, email, and password are required.",
    fallbackErrorMessage: "Could not create account.",
    logLabel: "signup action",
    run: (client, values, event) =>
      client.signUp.email({
        ...values,
        // Absolute URL required: Better Auth's verify-email link is opened
        // directly from the user's inbox (hitting apps/api's own origin),
        // and this is checked against trustedOrigins before it's honored.
        // Without it, the link would redirect back to apps/api itself,
        // which has no "/" route.
        callbackURL: `${event.url.origin}/login?verified=true`
      }),
    // requireEmailVerification is on: signUp.email succeeding here does NOT
    // create a session (no Set-Cookie) — the user still needs to click the
    // verification link, then log in normally. Don't redirect to "/" as if
    // they're already signed in.
    onSuccess: () => ({ success: true })
  })
};
