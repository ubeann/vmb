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

/**
 * Each resource carries what the Role form's grants section shows for it (P6
 * of the parity audit): a label, a one-line description, and the nouns its
 * actions' descriptions are worded with. They live here rather than in
 * `master.permissions`, so the words cannot drift from the keys.
 */
export const PERMISSION_CATALOGUE = [
  {
    resource: "master-divisions",
    label: "Divisions",
    description: "The company's divisions, and who leads each one.",
    noun: { one: "division", many: "divisions" },
    // `manager` marks a division leader, the check the legacy approval actions used
    actions: [...RECORD_ACTIONS, "manager"]
  },
  {
    resource: "master-roles",
    label: "Roles",
    description: "The roles people hold, and the permissions each one grants.",
    noun: { one: "role", many: "roles" },
    actions: HARD_DELETE_ACTIONS
  },
  {
    resource: "master-users",
    label: "Users",
    description: "The people who sign in, their roles and their status.",
    noun: { one: "user", many: "users" },
    actions: RECORD_ACTIONS
  }
] as const;

type CatalogueEntry = (typeof PERMISSION_CATALOGUE)[number];

/** Every action any resource offers. */
export type PermissionAction = CatalogueEntry["actions"][number];

type Noun = { one: string; many: string };

/**
 * What each action is called on the Role form, and a one-line description
 * worded with the resource's nouns ("Open the users list and search it.").
 * A record resource deletes into the Trash; one with no `restore` deletes
 * for good, so its delete says so.
 */
const PERMISSION_ACTIONS: Record<
  PermissionAction,
  { label: string; description: (noun: Noun, trash: boolean) => string }
> = {
  view_any: { label: "List", description: (noun) => `Open the ${noun.many} list and search it.` },
  view: { label: "View", description: (noun) => `Open one ${noun.one} and read its details.` },
  create: { label: "Create", description: (noun) => `Add a new ${noun.one}.` },
  update: { label: "Edit", description: (noun) => `Change an existing ${noun.one}.` },
  delete: {
    label: "Delete",
    description: (noun, trash) =>
      trash ? `Move one ${noun.one} to the Trash.` : `Delete one ${noun.one} for good.`
  },
  delete_any: {
    label: "Delete many",
    description: (noun, trash) =>
      trash
        ? `Move several ${noun.many} to the Trash at once.`
        : `Delete several ${noun.many} for good at once.`
  },
  restore: {
    label: "Restore",
    description: (noun) => `Bring one ${noun.one} back from the Trash.`
  },
  restore_any: {
    label: "Restore many",
    description: (noun) => `Bring several ${noun.many} back from the Trash at once.`
  },
  manager: {
    label: "Manager",
    description: () => "Lead a division: approve what its people request."
  }
};

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

/** One key as the Role form lists it. */
export type PermissionOption = {
  key: string;
  action: PermissionAction;
  label: string;
  description: string;
};

/** One resource's keys, as the Role form groups them. */
export type PermissionGroup = {
  resource: string;
  label: string;
  description: string;
  permissions: PermissionOption[];
};

/** The catalogue as the Role form shows it: one group per resource, in catalogue order. */
export function permissionGroups(): PermissionGroup[] {
  return PERMISSION_CATALOGUE.map((entry) => {
    const actions: readonly PermissionAction[] = entry.actions;
    const trash = actions.includes("restore");
    return {
      resource: entry.resource,
      label: entry.label,
      description: entry.description,
      permissions: actions.map((action) => ({
        key: permissionKey(entry.resource, action),
        action,
        label: PERMISSION_ACTIONS[action].label,
        description: PERMISSION_ACTIONS[action].description(entry.noun, trash)
      }))
    };
  });
}

const CATALOGUE_KEYS: ReadonlySet<string> = new Set(allPermissionKeys());

/** Whether `key` is one the catalogue defines. */
export function isPermissionKey(key: string): key is PermissionKey {
  return CATALOGUE_KEYS.has(key);
}
