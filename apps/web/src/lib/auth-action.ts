import type { RequestEvent } from "@sveltejs/kit";
import { fail } from "@sveltejs/kit";
import { EMAIL_INVALID_MESSAGE } from "@vmb/types";
import type { z } from "zod";
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

type AuthSchema = z.ZodObject<Record<string, z.ZodType<string>>>;

// The validated form: each field as the schema parsed it, each checkbox as a
// boolean.
type AuthActionValues<
  Schema extends AuthSchema,
  CheckboxField extends string = never
> = z.output<Schema> & Record<CheckboxField, boolean>;

type FieldOf<Schema extends AuthSchema> = keyof Schema["shape"] & string;

export interface AuthActionConfig<Schema extends AuthSchema, CheckboxField extends string = never> {
  // The rules for the form fields this action reads, shared with the page that
  // checks them in the browser (issue #231). A field the form left out reads
  // as an empty string, so the schema words the "required" case itself.
  schema: Schema;
  // Optional checkboxes this action reads. A ticked box is `true`; an unticked
  // one is left out of the submitted form entirely, so it reads as `false` and
  // is never a missing field (issue #206).
  checkboxes?: readonly CheckboxField[];
  // The banner for a failed check on a field the page shows no input for (a
  // hidden email carried between steps). A visible field shows its own message.
  invalidFieldsMessage: string;
  // Fallback for a Better Auth error that carries no message of its own.
  fallbackErrorMessage: string;
  // Identifies the route in the transport-failure log line.
  logLabel: string;
  // The route's Better Auth call, given the built client, the validated values,
  // and the request event (for values not in the form, such as a callback URL).
  run: (
    client: AuthApiClient,
    values: AuthActionValues<Schema, CheckboxField>,
    event: RequestEvent
  ) => Promise<AuthCallResult>;
  // What a successful call should do: redirect, or hand back the action data
  // the page expects. Receives the validated values so a multi-step route can
  // carry a value (an email, say) into the next step, and the request event
  // for what the next step reads from it (a cookie, say).
  onSuccess: (
    values: AuthActionValues<Schema, CheckboxField>,
    event: RequestEvent
  ) => MaybePromise<Data>;
  // Extra action data to merge into a failure response, for a multi-step route
  // that must render a step again after an error. `error` is Better Auth's,
  // when it turned the call down, so the route can pick the step the error
  // belongs to, and drop state the error makes stale (a cookie, say); a
  // failed field check or an unreachable API has none.
  failureData?: (
    values: Partial<Record<FieldOf<Schema>, string>>,
    event: RequestEvent,
    error?: AuthErrorLike
  ) => Data;
}

// The auth routes were near-identical: read fields, type-check them, build the
// auth client, call a Better Auth method, map `error` to a failure (issue #85).
// This is that one flow. Each route declares only what differs — its fields, its
// messages, its Better Auth call, and what success means.
export function createAuthAction<
  Schema extends AuthSchema,
  const CheckboxField extends string = never
>(config: AuthActionConfig<Schema, CheckboxField>) {
  return async (event: RequestEvent) => {
    const form = await event.request.formData();
    const submitted = {} as Record<FieldOf<Schema>, string>;
    for (const field of Object.keys(config.schema.shape) as FieldOf<Schema>[]) {
      const value = form.get(field);
      submitted[field] = typeof value === "string" ? value : "";
    }

    const parsed = config.schema.safeParse(submitted);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<FieldOf<Schema>, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldOf<Schema>;
        fieldErrors[field] ??= issue.message;
      }
      return fail(400, {
        ...config.failureData?.(submitted, event),
        error: config.invalidFieldsMessage,
        fieldErrors
      });
    }

    const checkboxValues = {} as Record<CheckboxField, boolean>;
    for (const checkbox of config.checkboxes ?? []) checkboxValues[checkbox] = form.has(checkbox);
    const values = { ...parsed.data, ...checkboxValues } as AuthActionValues<Schema, CheckboxField>;

    const access = await withAuthApiClient(event, (client) => config.run(client, values, event));

    if (!access.ok) {
      console.error(`${config.logLabel}: request to API failed`, access.error);
      return fail(500, {
        ...config.failureData?.(values, event),
        error: "Unable to reach the server. Check your connection and try again."
      });
    }

    if (access.value.error) {
      // Better Auth can reject an email the shared rule let through. Say so at
      // the email field, like any other email mistake, not in the banner.
      if (access.value.error.code === "INVALID_EMAIL" && "email" in config.schema.shape) {
        return fail(400, {
          ...config.failureData?.(values, event, access.value.error),
          error: EMAIL_INVALID_MESSAGE,
          fieldErrors: { email: EMAIL_INVALID_MESSAGE }
        });
      }

      return fail(400, {
        ...config.failureData?.(values, event, access.value.error),
        error: mapAuthErrorToCopy(access.value.error, config.fallbackErrorMessage)
      });
    }

    return config.onSuccess(values, event);
  };
}
