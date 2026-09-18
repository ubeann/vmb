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
    fields: ["email", "password"],
    missingFieldsMessage: "Email and password are required.",
    fallbackErrorMessage: "Invalid email or password.",
    logLabel: "login action",
    run: (client, values) => client.signIn.email(values),
    onSuccess: () => {
      redirect(303, "/");
    }
  })
};
