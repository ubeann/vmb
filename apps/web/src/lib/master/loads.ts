import { withApiClient } from "$lib/api-access.js";
import { listDivisions, listRoles } from "$lib/master/api.js";
import { DivisionListRequestSchema, RoleListRequestSchema, type Division } from "@vmb/types";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * Every division for the users list's filter. The list is small because one is
 * the same shape as a page; a failure degrades to an empty select rather than
 * taking the page down.
 */
export async function loadDivisionOptions(event: RequestEvent): Promise<Division[]> {
  const query = DivisionListRequestSchema.parse({ perPage: "100" });
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

/** A role a user can be given: what the form needs to show it. */
export type RoleOption = { id: string; name: string };

/**
 * Every active role, for the user form's checkboxes. A failure degrades to no
 * choices, and the form keeps showing the roles the user already holds, so a
 * save never silently removes one.
 */
export async function loadRoleOptions(event: RequestEvent): Promise<RoleOption[]> {
  const query = RoleListRequestSchema.parse({ perPage: "100", status: "active" });
  const access = await withApiClient(event, (client) => listRoles(client, query));

  if (!access.ok) {
    console.error("role options: failed to reach the API", access.error);
    return [];
  }
  if (!access.value.ok) {
    console.error("role options: API refused the request", access.value.error);
    return [];
  }

  return access.value.value.items.map(({ id, name }) => ({ id, name }));
}

/** The options with every role in `held` present, so none can be dropped by omission. */
export function mergeRoles(options: RoleOption[], held: RoleOption[]): RoleOption[] {
  const known = new Set(options.map((role) => role.id));
  return [...options, ...held.filter((role) => !known.has(role.id))].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
