import type { ApiClient } from "$lib/api.js";
import { withApiClient } from "$lib/api-access.js";
import { BulkRequestSchema, type BulkRequest, type BulkResponse } from "@vmb/types";
import { fail, redirect, type RequestEvent } from "@sveltejs/kit";
import type { ErrorStatus, FormPathLeavesWithErrors, Infer } from "sveltekit-superforms";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { zod4, type ZodValidationSchema } from "sveltekit-superforms/adapters";
import type { ApiResult } from "./api.js";

/**
 * The create and edit actions are the same flow — validate the submitted form
 * with the shared schema, call the API, put a domain error on the form (and
 * each issue it names on its field) or redirect to the record. Each route
 * declares only what differs.
 */
export function createMasterFormAction<T extends ZodValidationSchema>(config: {
  schema: T;
  logLabel: string;
  submit: (
    client: ApiClient,
    data: Infer<T, "zod4">,
    event: RequestEvent
  ) => Promise<ApiResult<{ id: string }>>;
  redirectTo: (record: { id: string }) => string;
}) {
  return async (event: RequestEvent) => {
    const form = await superValidate(event.request, zod4(config.schema));
    if (!form.valid) return fail(400, { form });

    const access = await withApiClient(event, (client) => config.submit(client, form.data, event));

    if (!access.ok) {
      console.error(`${config.logLabel}: request to API failed`, access.error);
      return message(form, "Something went wrong. Please try again.", { status: 500 });
    }

    if (!access.value.ok) {
      const { status, error, issues } = access.value;
      for (const issue of issues) {
        // the API validates with the same shared schema, so its paths are this form's
        setError(form, issue.path as FormPathLeavesWithErrors<Infer<T, "zod4">>, issue.message);
      }
      return message(form, error, { status });
    }

    redirect(303, config.redirectTo(access.value.value));
  };
}

/** The `id` a list row's delete or restore form submitted. */
async function submittedId(request: Request): Promise<string | null> {
  const data = await request.formData();
  const id = data.get("id");
  return typeof id === "string" && id ? id : null;
}

/**
 * A row action that takes the record's id from the submitted form — the list
 * page's delete and restore buttons. A successful action returns so SvelteKit
 * re-runs the load; a domain failure lands on the page as `form.error`, with
 * its API `code` as `form.code`.
 */
export async function runRowAction(
  event: RequestEvent,
  config: {
    logLabel: string;
    run: (client: ApiClient, id: string) => Promise<ApiResult<unknown>>;
    onSuccess?: () => unknown;
  }
) {
  const id = await submittedId(event.request);
  if (!id) return fail(400, { error: "Missing record id." });

  const access = await withApiClient(event, (client) => config.run(client, id));

  if (!access.ok) {
    console.error(`${config.logLabel}: request to API failed`, access.error);
    return fail(500, { error: "Something went wrong. Please try again." });
  }

  if (!access.value.ok) {
    // the code rides along so a page can act on a refusal it knows, such as `DIVISION_IN_USE`
    return fail(access.value.status as ErrorStatus, {
      error: access.value.error,
      code: access.value.code
    });
  }

  return config.onSuccess ? config.onSuccess() : { ok: true };
}

/**
 * The list page's bulk action (#305): the form carries `action` (delete or
 * restore) and one `ids` field per chosen row. The API takes them all or none,
 * so a refusal lands on the page as `form.error` and its `code`, as a row
 * action's does, and a success answers with the ids it changed.
 */
export async function runBulkAction(
  event: RequestEvent,
  config: {
    logLabel: string;
    run: (client: ApiClient, request: BulkRequest) => Promise<ApiResult<BulkResponse>>;
  }
) {
  const data = await event.request.formData();
  const request = BulkRequestSchema.safeParse({
    action: data.get("action"),
    ids: data.getAll("ids")
  });
  if (!request.success) {
    return fail(400, { error: request.error.issues[0]?.message ?? "Choose records first." });
  }

  const access = await withApiClient(event, (client) => config.run(client, request.data));

  if (!access.ok) {
    console.error(`${config.logLabel}: request to API failed`, access.error);
    return fail(500, { error: "Something went wrong. Please try again." });
  }

  if (!access.value.ok) {
    return fail(access.value.status as ErrorStatus, {
      error: access.value.error,
      code: access.value.code
    });
  }

  return { ok: true, ids: access.value.value.ids };
}
