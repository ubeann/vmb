import { createAuthAction, type AuthActionConfig } from "$lib/auth-action.js";
import type { AuthErrorLike } from "$lib/auth-error-copy.js";
import {
  clearCheckedCode,
  keepCheckedCode,
  readCheckedCode,
  type CheckedCode
} from "$lib/server/checked-code.js";
import { fail, redirect, type RequestEvent } from "@sveltejs/kit";
import {
  ActivatePasswordInputSchema,
  ActivateRequestInputSchema,
  ActivateVerifyInputSchema
} from "@vmb/types";
import type { Actions, PageServerLoad } from "./$types.js";

// Activation (ADR-0033): a migrated user has no password, so this is the way
// in the first time. Three steps on one route (#254): the email, then the
// code it was sent (checked, not yet used up), then the new password. The
// code proves the inbox before a password is set.
//
// The email and code steps are carried in each action's reply. The password
// step is not: it is reached only through a checked code, kept in a cookie
// (`$lib/server/checked-code.js`), so this load picks it, and a reload keeps it.
export const load: PageServerLoad = ({ locals, cookies }) => {
  if (locals.user) {
    redirect(303, "/");
  }
  const checked = readCheckedCode(cookies);
  // The email only: the code stays on the server.
  return { step: checked ? ("password" as const) : undefined, email: checked?.email };
};

// The code request shared by the email step and "Send a new code".
const requestCodeConfig = {
  schema: ActivateRequestInputSchema,
  fallbackErrorMessage: "Unable to send the code. Try again.",
  run: (client, values) => client.emailOtp.requestPasswordReset({ email: values.email }),
  onSuccess: (values) => ({ step: "code" as const, email: values.email })
} satisfies Partial<AuthActionConfig<typeof ActivateRequestInputSchema>>;

// Requesting a code starts over, so a code checked earlier is dropped first,
// whatever then becomes of the request. Kept, it would put the load back on
// the password step.
function startingOver<Reply>(action: (event: RequestEvent) => Reply) {
  return (event: RequestEvent) => {
    clearCheckedCode(event.cookies);
    return action(event);
  };
}

// Better Auth's refusals that are about the code, not the password: each one
// sends the password step back to the code step.
const CODE_ERRORS = new Set(["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS"]);
const isCodeError = (error?: AuthErrorLike) => !!error?.code && CODE_ERRORS.has(error.code);

// The checked code is kept no longer than the code itself lasts, so once it
// has gone the code has expired too.
const CHECK_EXPIRED_MESSAGE = "Your code expired. Enter your email to get a new one.";

// Set password, for the code Verify checked: its email and code come from the
// cookie alone, never the form.
const setPassword = (checked: CheckedCode) =>
  createAuthAction({
    schema: ActivatePasswordInputSchema,
    invalidFieldsMessage: "Enter a new password",
    fallbackErrorMessage: "Unable to set your password. Try again.",
    logLabel: "activate reset action",
    // An expired, used-up or wrong code goes back to the code step, with the
    // email kept so "Send a new code" is one press away, and the checked code
    // dropped. Anything else, such as a rate limit, keeps the password step.
    failureData: (_values, event, error) => {
      if (!isCodeError(error)) return { step: "password" as const, email: checked.email };
      clearCheckedCode(event.cookies);
      return { step: "code" as const, email: checked.email, errorAt: "code" as const };
    },
    run: (client, values) =>
      client.emailOtp.resetPassword({ ...checked, password: values.password }),
    onSuccess: (_values, event) => {
      clearCheckedCode(event.cookies);
      redirect(303, "/login?activated=true");
    }
  });

export const actions: Actions = {
  request: startingOver(
    createAuthAction({
      ...requestCodeConfig,
      invalidFieldsMessage: "Enter your email",
      logLabel: "activate request action"
    })
  ),
  // "Send a new code" requests the same code from the code step, and stays
  // there when it fails, such as on a rate limit (#251), so the error shows
  // where the user pressed it.
  resend: startingOver(
    createAuthAction({
      ...requestCodeConfig,
      invalidFieldsMessage: "Reload this page, enter your email, and request a new code",
      logLabel: "activate resend action",
      failureData: (values) => ({ step: "code" as const, email: values.email ?? "" })
    })
  ),
  // The code step's Verify. Better Auth's check counts a wrong try toward the
  // code's 3 attempts but does not use the code up, so the password step can
  // still spend it. An unregistered email has no code, and gets INVALID_OTP,
  // the same reply as a wrong code (#232).
  verify: createAuthAction({
    schema: ActivateVerifyInputSchema,
    invalidFieldsMessage: "Reload this page, enter your email, and request a new code",
    fallbackErrorMessage: "Unable to verify the code. Try again.",
    logLabel: "activate verify action",
    // A refused code keeps the code step and the email. `errorAt` has the page
    // show the error under the code, where the user is looking, not in the
    // banner "Send a new code" uses.
    failureData: (values) => ({
      step: "code" as const,
      email: values.email ?? "",
      errorAt: "code" as const
    }),
    run: (client, values) =>
      client.emailOtp.checkVerificationOtp({
        email: values.email,
        otp: values.otp,
        type: "forget-password"
      }),
    onSuccess: (values, event) => {
      keepCheckedCode(event, { email: values.email, otp: values.otp });
      return { step: "password" as const, email: values.email };
    }
  }),
  // Set password, only with a checked code in the cookie.
  reset: async (event) => {
    const checked = readCheckedCode(event.cookies);
    if (!checked) {
      return fail(400, { step: "request" as const, email: "", error: CHECK_EXPIRED_MESSAGE });
    }
    return setPassword(checked)(event);
  },
  // "Use a different email" on the password step: starts over, with the email
  // in the field to fix.
  restart: ({ cookies }) => {
    const email = readCheckedCode(cookies)?.email ?? "";
    clearCheckedCode(cookies);
    return { step: "request" as const, email };
  }
};
