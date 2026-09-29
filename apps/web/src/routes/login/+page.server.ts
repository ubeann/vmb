import { createAuthAction } from "$lib/auth-action.js";
import { redirect } from "@sveltejs/kit";
import { LoginInputSchema } from "@vmb/types";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) {
    redirect(303, "/");
  }
};

export const actions: Actions = {
  default: createAuthAction({
    schema: LoginInputSchema,
    // Unticked gives a browser-session cookie (ADR-0034's amendment, #206).
    checkboxes: ["rememberMe"],
    invalidFieldsMessage: "Enter your email and password",
    fallbackErrorMessage: "Invalid email or password.",
    logLabel: "login action",
    run: (client, values) => client.signIn.email(values),
    onSuccess: () => {
      redirect(303, "/");
    }
  })
};
