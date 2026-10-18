import { withApiClient } from "$lib/api-access.js";
import { listDivisions, listRoles } from "$lib/master/api.js";
import {
  DivisionListRequestSchema,
  RoleListRequestSchema,
  type Division,
  type Role
} from "@vmb/types";
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
 * Every role the caller may list, active or not, page after page. A failure
 * degrades to the roles read so far, named in the log by `label`.
 */
async function loadAllRoles(event: RequestEvent, label: string): Promise<Role[]> {
  const roles: Role[] = [];

  for (let page = 1; ; page++) {
    const query = RoleListRequestSchema.parse({ perPage: "100", page: String(page) });
    const access = await withApiClient(event, (client) => listRoles(client, query));

    if (!access.ok) {
      console.error(`${label}: failed to reach the API`, access.error);
      return roles;
    }
    if (!access.value.ok) {
      console.error(`${label}: API refused the request`, access.value.error);
      return roles;
    }

    const { items, total } = access.value.value;
    roles.push(...items);
    if (items.length === 0 || roles.length >= total) return roles;
  }
}

/**
 * Every role, active or not, for the Users list's Role filter: a user can hold
 * a role that has since gone Inactive. Only the roles the caller may list come
 * back, every page of them, and a failure degrades to the roles read so far.
 */
export async function loadRoleFilterOptions(
  event: RequestEvent
): Promise<Array<{ id: string; name: string }>> {
  const roles = await loadAllRoles(event, "role filter options");
  return roles.map(({ id, name }) => ({ id, name }));
}

/**
 * A role a user can be given: what the form needs to show it. A role scoped to
 * an Inactive Division cannot be newly given, so the form offers it only to
 * the user who already holds it (the Inactive rule, #304). Nor can an inactive
 * role, or one the caller may not grant.
 */
export type RoleOption = {
  id: string;
  name: string;
  isActive: boolean;
  /** The Division it is scoped to, when the caller can read Divisions; none means every Division. */
  divisionName: string | null;
  divisionInactive: boolean;
  /** Whether the caller holds every permission it grants (from the API); if not, it is not theirs to give or take away. */
  grantable: boolean;
};

/**
 * Every role, for the user form's combobox, inactive ones too, so a role the
 * user holds shows whether the caller may take it away. A failure degrades to
 * no choices, and the form keeps showing the roles the user already holds, so
 * a save never silently removes one. Every page is read, so a role past the
 * first hundred is still offered. Without `master-divisions.view_any` the
 * roles carry no Division name and none counts as inactive: the API refuses
 * what the rule forbids.
 */
export async function loadRoleOptions(event: RequestEvent): Promise<RoleOption[]> {
  const [roles, divisions] = await Promise.all([
    loadAllRoles(event, "role options"),
    loadDivisionOptions(event)
  ]);

  const byId = new Map(divisions.map((division) => [division.id, division]));
  return roles.map(({ id, name, isActive, divisionId, grantable }) => {
    const division = divisionId ? byId.get(divisionId) : undefined;
    return {
      id,
      name,
      isActive,
      divisionName: division?.name ?? null,
      divisionInactive: division ? !division.isActive : false,
      grantable
    };
  });
}

/**
 * The roles to offer: the active options minus those of an Inactive Division,
 * plus every role in `held`, so none can be dropped by omission. A held role
 * keeps its Division's state, and is marked as such where it shows. One the
 * options did not return is taken as active and grantable: the API decides.
 */
export function roleChoices(options: RoleOption[], held: Array<{ id: string; name: string }>) {
  const heldIds = new Set(held.map((role) => role.id));
  const offered = options.filter(
    (role) => (role.isActive && !role.divisionInactive) || heldIds.has(role.id)
  );
  const known = new Set(options.map((role) => role.id));
  const missing = held
    .filter((role) => !known.has(role.id))
    .map((role) => ({
      ...role,
      isActive: true,
      divisionName: null,
      divisionInactive: false,
      grantable: true
    }));
  return [...offered, ...missing].sort((a, b) => a.name.localeCompare(b.name));
}

/** A Division a role can be placed in, as the Role form's combobox lists it. */
export type DivisionChoice = { id: string; name: string; inactive: boolean };

/**
 * The Divisions to offer a role: the Active ones, plus the role's current
 * Division even when it is Inactive, Trashed, or one the caller cannot list, so
 * a save never moves a role out of it by omission. An Inactive Division is not
 * offered for a new choice (the Inactive rule), and the current one is marked
 * as such where it shows.
 */
export function divisionChoices(
  divisions: Division[],
  current: DivisionChoice | null
): DivisionChoice[] {
  const offered = divisions
    .filter((division) => division.isActive && division.id !== current?.id)
    .map(({ id, name }) => ({ id, name, inactive: false }));
  return [...(current ? [current] : []), ...offered].sort((a, b) => a.name.localeCompare(b.name));
}
