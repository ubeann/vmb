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

/**
 * A role a user can be given: what the form needs to show it. A role scoped to
 * an Inactive Division cannot be newly given, so the form offers it only to
 * the user who already holds it (the Inactive rule, #304).
 */
export type RoleOption = {
  id: string;
  name: string;
  /** The Division it is scoped to, when the caller can read Divisions; none means every Division. */
  divisionName: string | null;
  divisionInactive: boolean;
};

/**
 * Every active role, for the user form's combobox. A failure degrades to no
 * choices, and the form keeps showing the roles the user already holds, so a
 * save never silently removes one. Without `master-divisions.view_any` the
 * roles carry no Division name and none counts as inactive: the API refuses
 * what the rule forbids.
 */
export async function loadRoleOptions(event: RequestEvent): Promise<RoleOption[]> {
  const roleQuery = RoleListRequestSchema.parse({ perPage: "100", status: "active" });
  const [roles, divisions] = await Promise.all([
    withApiClient(event, (client) => listRoles(client, roleQuery)),
    loadDivisionOptions(event)
  ]);

  if (!roles.ok) {
    console.error("role options: failed to reach the API", roles.error);
    return [];
  }
  if (!roles.value.ok) {
    console.error("role options: API refused the request", roles.value.error);
    return [];
  }

  const byId = new Map(divisions.map((division) => [division.id, division]));
  return roles.value.value.items.map(({ id, name, divisionId }) => {
    const division = divisionId ? byId.get(divisionId) : undefined;
    return {
      id,
      name,
      divisionName: division?.name ?? null,
      divisionInactive: division ? !division.isActive : false
    };
  });
}

/**
 * The roles to offer: the options minus those of an Inactive Division, plus
 * every role in `held`, so none can be dropped by omission. A held role keeps
 * its Division's state, and is marked as such where it shows.
 */
export function roleChoices(options: RoleOption[], held: Array<{ id: string; name: string }>) {
  const heldIds = new Set(held.map((role) => role.id));
  const offered = options.filter((role) => !role.divisionInactive || heldIds.has(role.id));
  const known = new Set(options.map((role) => role.id));
  const missing = held
    .filter((role) => !known.has(role.id))
    .map((role) => ({ ...role, divisionName: null, divisionInactive: false }));
  return [...offered, ...missing].sort((a, b) => a.name.localeCompare(b.name));
}
