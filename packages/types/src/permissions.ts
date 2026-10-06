/**
 * The permission catalogue: every capability the code can check, as
 * `resource.action` keys (`master-users.view_any`). The catalogue is the single
 * source of truth; `master.permissions` is its projection, so a grant can carry
 * a foreign key. Resources follow the legacy `PermissionRegistry` names so the
 * exported role matrix (D-003) maps one to one.
 *
 * Only Master is catalogued so far; each domain adds its own resources with its
 * module (#9 to #16).
 */
const RECORD_ACTIONS = [
  "view_any",
  "view",
  "create",
  "update",
  "delete",
  "delete_any",
  "restore",
  "restore_any"
] as const;

// Roles are deleted permanently (no Trash), so they have nothing to restore.
const HARD_DELETE_ACTIONS = [
  "view_any",
  "view",
  "create",
  "update",
  "delete",
  "delete_any"
] as const;

export const PERMISSION_CATALOGUE = [
  // `manager` marks a division leader, the check the legacy approval actions used
  { resource: "master-divisions", actions: [...RECORD_ACTIONS, "manager"] },
  { resource: "master-roles", actions: HARD_DELETE_ACTIONS },
  { resource: "master-users", actions: RECORD_ACTIONS }
] as const;

/** Every key the catalogue defines, as a union, so a route cannot name one that does not exist. */
export type PermissionKey = {
  [
    E in (typeof PERMISSION_CATALOGUE)[number] as E["resource"]
  ]: `${E["resource"]}.${E["actions"][number]}`;
}[(typeof PERMISSION_CATALOGUE)[number]["resource"]];

export function permissionKey(resource: string, action: string): string {
  return `${resource}.${action}`;
}

/** Every key the catalogue defines, in catalogue order. */
export function allPermissionKeys(): string[] {
  return PERMISSION_CATALOGUE.flatMap(({ resource, actions }) =>
    actions.map((action) => permissionKey(resource, action))
  );
}
