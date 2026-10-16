import { deserialize } from "$app/forms";
import type { BulkRequest } from "@vmb/types";

const GENERIC = "Something went wrong. Please try again.";

/**
 * Post a list row's action (`/master/divisions?/restore`) for one record
 * outside a form, as the toast's Undo and the Trash tab's Restore do. The path
 * names the list route, since an Undo can be clicked after leaving the list. The failure's
 * message is the one the route's action put on `error`, which is the API's own
 * copy, read through `$lib/master/api.ts` (a 409 on restore says which name or
 * code was taken). The caller refreshes the list on success.
 */
export async function postRowAction(
  action: `${string}?/${string}`,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = new FormData();
  body.set("id", id);
  return post(action, body);
}

/**
 * Post a list's bulk action (`/master/divisions?/bulk`) outside a form, as the
 * toast's Undo does (#305): the same `action` and `ids` the bulk form carries.
 * It answers as `postRowAction` does, with the API's own copy on a refusal.
 */
export function postBulkAction(
  action: `${string}?/${string}`,
  request: BulkRequest
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = new FormData();
  body.set("action", request.action);
  for (const id of request.ids) body.append("ids", id);
  return post(action, body);
}

async function post(
  action: `${string}?/${string}`,
  body: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  let result;
  try {
    const response = await fetch(action, {
      method: "POST",
      body,
      headers: { "x-sveltekit-action": "true" }
    });
    result = deserialize(await response.text());
  } catch {
    return { ok: false, error: GENERIC };
  }

  if (result.type === "success" || result.type === "redirect") return { ok: true };
  if (result.type === "failure" && typeof result.data?.error === "string") {
    return { ok: false, error: result.data.error };
  }
  return { ok: false, error: GENERIC };
}
