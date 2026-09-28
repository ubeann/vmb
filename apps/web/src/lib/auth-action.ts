import type { RequestEvent } from "@sveltejs/kit";
import { fail } from "@sveltejs/kit";
import { withAuthApiClient } from "./api-access.js";
import type { AuthErrorLike } from "./auth-error-copy.js";
import { mapAuthErrorToCopy } from "./auth-error-copy.js";
import type { AuthApiClient } from "./auth.js";

type Data = Record<string, unknown> | void;
type MaybePromise<T> = T | Promise<T>;

// The shared shape of the Better Auth calls these actions make: a resolved
// call reports a domain failure through `error` (its message is optional)
// rather than throwing. A thrown transport failure is different, and stays
// owned by the access seam (issue #82). `code` and `status` (from
// `AuthErrorLike`) drive the copy mapping in `auth-error-copy.js`; `message`
// is Better Auth's own developer text and is never shown to a user (issue #205).
export interface AuthCallResult {
  error?: (AuthErrorLike & { message?: string }) | null;
}

export interface AuthActionConfig<Field extends string> {
  // The form fields this action reads. Each must be a present, non-empty string.
  fields: readonly Field[];
  // Returned when any field is missing, naming the fields the user must supply.
  missingFieldsMessage: string;
  // Fallback for a Better Auth error that carries no message of its own.
  fallbackErrorMessage: string;
  // Identifies the route in the transport-failure log line.
  logLabel: string;
  // The route's Better Auth call, given the built client, the validated values,
  // and the request event (for values not in the form, such as a callback URL).
  run: (
    client: AuthApiClient,
    values: Record<Field, string>,
    event: RequestEvent
  ) => Promise<AuthCallResult>;
  // What a successful call should do: redirect, or hand back the action data
  // the page expects. Receives the validated values so a multi-step route can
  // carry a value (an email, say) into the next step.
  onSuccess: (values: Record<Field, string>) => MaybePromise<Data>;
  // Extra action data to merge into a failure response, for a multi-step route
  // that must render the same step again after an error.
  failureData?: (values: Partial<Record<Field, string>>) => Data;
}

// The auth routes were near-identical: read fields, type-check them, build the
// auth client, call a Better Auth method, map `error` to a failure (issue #85).
// This is that one flow. Each route declares only what differs — its fields, its
// messages, its Better Auth call, and what success means.
export function createAuthAction<const Field extends string>(config: AuthActionConfig<Field>) {
  return async (event: RequestEvent) => {
    const form = await event.request.formData();
    const values = {} as Record<Field, string>;
    const fieldErrors: Partial<Record<Field, string>> = {};

    for (const field of config.fields) {
      const value = form.get(field);
      if (typeof value !== "string" || !value) {
        fieldErrors[field] =
          `${field === "otp" ? "Code" : field.charAt(0).toUpperCase() + field.slice(1)} is required.`;
      } else {
        values[field] = value;
      }
    }

    if (Object.keys(fieldErrors).length) {
      return fail(400, {
        ...config.failureData?.(values),
        error: config.missingFieldsMessage,
        fieldErrors
      });
    }

    const access = await withAuthApiClient(event, (client) => config.run(client, values, event));

    if (!access.ok) {
      console.error(`${config.logLabel}: request to API failed`, access.error);
      return fail(500, {
        ...config.failureData?.(values),
        error: "Unable to reach the server. Check your connection and try again."
      });
    }

    if (access.value.error) {
      return fail(400, {
        ...config.failureData?.(values),
        error: mapAuthErrorToCopy(access.value.error, config.fallbackErrorMessage)
      });
    }

    return config.onSuccess(values);
  };
}
