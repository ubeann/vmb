import type { RequestEvent } from "@sveltejs/kit";
import { fail } from "@sveltejs/kit";
import { withAuthApiClient } from "./api-access.js";
import type { AuthApiClient } from "./auth.js";

type Data = Record<string, unknown> | void;
type MaybePromise<T> = T | Promise<T>;

// The shared shape of the Better Auth calls these actions make: a resolved
// call reports a domain failure through `error` (its message is optional)
// rather than throwing. A thrown transport failure is different, and stays
// owned by the access seam (issue #82).
export interface AuthCallResult {
  error?: { message?: string } | null;
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
  // the page expects. Receives the event for the same reason `run` does.
  onSuccess: (values: Record<Field, string>, event: RequestEvent) => MaybePromise<Data>;
}

// Same message for both routes' transport failure, so it lives here once.
const transportFailure = { error: "Something went wrong. Please try again." };

// Login and signup were near-identical: read fields, type-check them, build the
// auth client, call a Better Auth method, map `error` to a failure (issue #85).
// This is that one flow. Each route declares only what differs — its fields, its
// messages, its Better Auth call, and what success means.
export function createAuthAction<const Field extends string>(config: AuthActionConfig<Field>) {
  return async (event: RequestEvent) => {
    const form = await event.request.formData();
    const values = {} as Record<Field, string>;

    for (const field of config.fields) {
      const value = form.get(field);
      if (typeof value !== "string" || !value) {
        return fail(400, { error: config.missingFieldsMessage });
      }
      values[field] = value;
    }

    const access = await withAuthApiClient(event, (client) => config.run(client, values, event));

    if (!access.ok) {
      console.error(`${config.logLabel}: request to API failed`, access.error);
      return fail(500, transportFailure);
    }

    if (access.value.error) {
      return fail(400, {
        error: access.value.error.message ?? config.fallbackErrorMessage
      });
    }

    return config.onSuccess(values, event);
  };
}
