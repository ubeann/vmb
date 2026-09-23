import { withApiClient } from "$lib/api-access.js";
import { listDivisions } from "$lib/master/api.js";
import { DivisionListQuerySchema, type Division } from "@vmb/types";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * Every division for a user form's select. The list is small because one is
 * the same shape as a page; a failure degrades to an empty select rather than
 * taking the form down, and the submit then fails on the missing division.
 */
export async function loadDivisionOptions(event: RequestEvent): Promise<Division[]> {
  const query = DivisionListQuerySchema.parse({ perPage: "100" });
  const access = await withApiClient(event, (client) => listDivisions(client, query));

  if (!access.ok) {
    console.error("division options: failed to reach the API", access.error);
    return [];
  }
  if (!access.value.ok) {
    console.error("division options: API refused the request", access.value.error);
    return [];
  }

  return access.value.value.items;
}
