import { createAuthAction, type AuthActionConfig } from "$lib/auth-action.js";
import { redirect } from "@sveltejs/kit";
import { ActivateRequestInputSchema, ActivateResetInputSchema } from "@vmb/types";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) {
    redirect(303, "/");
  }
};

// The code request shared by the email step and "Send a new code".
const requestCodeConfig = {
  schema: ActivateRequestInputSchema,
  fallbackErrorMessage: "Could not send the code. Please try again.",
  run: (client, values) => client.emailOtp.requestPasswordReset({ email: values.email }),
  onSuccess: (values) => ({ step: "reset" as const, email: values.email })
} satisfies Partial<AuthActionConfig<typeof ActivateRequestInputSchema>>;

// Activation (ADR-0033): a migrated user has no password, so this is the way
// in the first time. Two steps because the code proves the inbox before a
// password is set: request the code, then submit it with the new password.
export const actions: Actions = {
  request: createAuthAction({
    ...requestCodeConfig,
    invalidFieldsMessage: "Enter your email",
    logLabel: "activate request action"
  }),
  // "Send a new code" requests the same code from the code step, and stays
  // there when it fails, such as on a rate limit (#251), so the error shows
  // where the user pressed it.
  resend: createAuthAction({
    ...requestCodeConfig,
    invalidFieldsMessage: "Reload this page, enter your email, and request a new code",
    logLabel: "activate resend action",
    failureData: (values) => ({ step: "reset" as const, email: values.email ?? "" })
  }),
  reset: createAuthAction({
    schema: ActivateResetInputSchema,
    invalidFieldsMessage: "Reload this page, enter your email, and request a new code",
    fallbackErrorMessage: "Could not set your password. Check the code and try again.",
    logLabel: "activate reset action",
    // A failed reset re-renders the code step, so the user's entered code and
    // email are not thrown away.
    failureData: (values) => ({ step: "reset" as const, email: values.email ?? "" }),
    run: (client, values) =>
      client.emailOtp.resetPassword({
        email: values.email,
        otp: values.otp,
        password: values.password
      }),
    onSuccess: () => {
      redirect(303, "/login?activated=true");
    }
  })
};
