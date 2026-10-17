import { allPermissionKeys, lucideForLegacyIcon } from "@vmb/types";
import { createHash } from "node:crypto";
import type { SqlClient } from "../sql-client.js";
import { quoteLiteral } from "./load.js";
import type { Snapshot } from "./snapshot.js";
import type { Finding } from "./verify.js";

/** What the RBAC transform carried, for the report's `rbac` section. */
export type RbacReport = {
  /** `master.roles` rows written: carried roles plus split copies. */
  rolesCarried: number;
  /** Legacy roles held in several divisions, each written as one copy per division. */
  rolesSplit: number;
  /** `master.role_permissions` rows written, Super Admin's included. */
  grants: number;
  /** `master.user_roles` rows written. */
  assignments: number;
  /** Legacy permissions with no catalogue key, left in the snapshot. */
  unmappedPermissions: number;
};

/** A `master.roles` row to write. A null field takes the column default. */
type PlannedRole = {
  id: string;
  name: string;
  divisionId: string | null;
  colorHex: string | null;
  iconName: string | null;
  description: string | null;
  isActive: boolean | null;
  isSystem: boolean | null;
  /** Jakarta wall-clocks, as the snapshot holds them. */
  createdAt: string | null;
  updatedAt: string | null;
};

export type RbacPlan = {
  roles: PlannedRole[];
  grants: { roleId: string; permissionKey: string }[];
  /** `createdAt` is the later of the user's and the role's legacy `created_at`. */
  assignments: { userId: string; roleId: string; createdAt: string | null }[];
  findings: Finding[];
  report: RbacReport;
};

/**
 * Legacy role names mapped onto revamp's base name before a split copy gets its
 * division appended (ADR-0056). Any other name splits as it is.
 */
const ROLE_RENAMES: Readonly<Record<string, string>> = {
  "Manager Division": "Manager"
};

/** The system role that holds every catalogue key. */
const SUPER_ADMIN = "Super Admin";

const COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * The RBAC half of the cutover (#311, ADR-0056): legacy Spatie roles, grants and
 * assignments, plus each user's legacy `division_id`, become `master.roles`,
 * `master.role_permissions` and `master.user_roles`.
 *
 * It reads the parsed snapshot rather than the database: the legacy role tables
 * are never loaded, and migration `0030` has already dropped
 * `users.division_id` by the time it runs. It runs after the identity
 * transform, inside one transaction, and returns its findings for the report.
 */
export async function transformRbac(
  client: SqlClient,
  snapshot: Snapshot
): Promise<{ report: RbacReport; findings: Finding[] }> {
  const plan = planRbac(snapshot);

  await client.exec("begin");
  try {
    for (const statement of insertStatements(plan)) {
      await client.exec(statement);
    }
    await client.exec("commit");
  } catch (error) {
    await client.exec("rollback");
    throw error;
  }

  return { report: plan.report, findings: plan.findings };
}

type LegacyRole = {
  id: string;
  name: string;
  isSystem: boolean;
  colorHex: string | null;
  iconName: string | null;
  description: string | null;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type LegacyUser = {
  id: string;
  name: string;
  status: string;
  divisionId: string | null;
  createdAt: string | null;
  deletedAt: string | null;
};

/** Decide every row and finding from the snapshot alone; nothing is written. */
export function planRbac(snapshot: Snapshot): RbacPlan {
  const findings: Finding[] = [];
  const error = (code: string, message: string) => findings.push({ level: "error", code, message });
  const warning = (code: string, message: string) =>
    findings.push({ level: "warning", code, message });

  const divisionNames = new Map(
    records(snapshot, "master.divisions", ["id", "name"]).map((row) => [
      row.id as string,
      row.name as string
    ])
  );

  const users = new Map<string, LegacyUser>(
    records(snapshot, "master.users", ["id", "name"]).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        name: row.name as string,
        status: row.status ?? "active",
        divisionId: row.division_id ?? null,
        createdAt: row.created_at ?? null,
        deletedAt: row.deleted_at ?? null
      }
    ])
  );

  const permissionNames = new Map(
    records(snapshot, "master.permissions", ["uuid", "name"]).map((row) => [
      row.uuid as string,
      row.name as string
    ])
  );

  // A role named only by case apart from one already seen is not carried
  // (`master_roles_name_unique` is case-insensitive), so its holders and grants
  // go with it.
  const legacyRoles: LegacyRole[] = [];
  const byLowerName = new Map<string, LegacyRole>();
  for (const row of records(snapshot, "master.roles", ["uuid", "name"])) {
    const role: LegacyRole = {
      id: row.uuid as string,
      name: row.name as string,
      isSystem: bool(row.is_system) ?? false,
      colorHex: row.color_hex ?? null,
      iconName: row.icon_name ?? null,
      description: row.description ?? null,
      isActive: bool(row.is_active),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null
    };
    const clash = byLowerName.get(role.name.toLowerCase());
    if (clash) {
      error(
        "role-name",
        `role ${describe(role)} differs from ${describe(clash)} only by case, so it is not carried`
      );
      continue;
    }
    byLowerName.set(role.name.toLowerCase(), role);
    legacyRoles.push(role);
  }
  const rolesById = new Map(legacyRoles.map((role) => [role.id, role]));

  const superAdmin = legacyRoles.find((role) => role.isSystem && role.name === SUPER_ADMIN);
  if (!superAdmin) {
    error(
      "super-admin",
      `the snapshot has no system role named ${SUPER_ADMIN}, so nobody holds every permission`
    );
  }

  // Only rows naming a user the snapshot carries count: `model_id` is
  // polymorphic and has no foreign key, and Spatie detaches a user's roles when
  // the user is deleted, so a row naming no user names nothing.
  const holdings = records(snapshot, "spatie.model_has_roles", ["role_uuid", "model_id"]).flatMap(
    (row) => {
      const user = users.get(row.model_id as string);
      return user ? [{ user, roleId: row.role_uuid as string }] : [];
    }
  );

  // The divisions each role is held in, ordered by division name so the copies
  // come out in a stable order.
  const divisionsOf = new Map<string, string[]>();
  for (const { user, roleId } of holdings) {
    if (user.divisionId === null) continue;
    const divisions = divisionsOf.get(roleId) ?? [];
    if (!divisions.includes(user.divisionId)) divisions.push(user.divisionId);
    divisionsOf.set(roleId, divisions);
  }
  const divisionLabel = (id: string) => divisionNames.get(id) ?? id;
  for (const divisions of divisionsOf.values()) {
    divisions.sort(
      (a, b) => divisionLabel(a).localeCompare(divisionLabel(b)) || a.localeCompare(b)
    );
  }

  const roles: PlannedRole[] = [];
  const plannedByLowerName = new Map<string, PlannedRole>();
  // legacy role id → the row each holder gets: one for every division (null), or one per division
  const targets = new Map<string, Map<string | null, string>>();
  let rolesSplit = 0;

  const emit = (role: LegacyRole, id: string, name: string, divisionId: string | null) => {
    const clash = plannedByLowerName.get(name.toLowerCase());
    if (clash) {
      error(
        "role-name",
        `role ${describe(role)} would be carried as ${name}, which differs from ${describe(clash)} only by case, so it is not carried`
      );
      return;
    }
    const planned: PlannedRole = {
      id,
      name,
      divisionId,
      colorHex: role.colorHex !== null && COLOR_HEX.test(role.colorHex) ? role.colorHex : null,
      iconName: role.iconName === null ? null : lucideForLegacyIcon(role.iconName),
      description: role.description,
      isActive: role.isActive,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
    plannedByLowerName.set(name.toLowerCase(), planned);
    roles.push(planned);
    const target = targets.get(role.id) ?? new Map<string | null, string>();
    target.set(divisionId, id);
    targets.set(role.id, target);
  };

  for (const role of legacyRoles) {
    if (role.colorHex !== null && !COLOR_HEX.test(role.colorHex)) {
      warning(
        "color-hex",
        `role ${describe(role)}: colour "${role.colorHex}" is not #RRGGBB, so it takes the column default`
      );
    }

    const divisions = divisionsOf.get(role.id) ?? [];
    if (role.isSystem || divisions.length <= 1) {
      // a system role operates everywhere; a role nobody holds stays unscoped
      // too, since no holder says which division it belongs to
      emit(role, role.id, role.name, role.isSystem ? null : (divisions[0] ?? null));
      continue;
    }

    rolesSplit++;
    const base = Object.hasOwn(ROLE_RENAMES, role.name)
      ? (ROLE_RENAMES[role.name] as string)
      : role.name;
    for (const divisionId of divisions) {
      emit(
        role,
        roleCopyId(role.id, divisionId),
        `${base} - ${divisionLabel(divisionId)}`,
        divisionId
      );
    }
  }

  const assignments: RbacPlan["assignments"] = [];
  const assigned = new Set<string>();
  const divisionless = new Set<string>();
  for (const { user, roleId } of holdings) {
    const role = rolesById.get(roleId);
    if (!role) continue;

    // a system role's holder needs no division, and has theirs dropped
    if (!role.isSystem && user.divisionId === null) {
      error(
        "user-division",
        `user ${describe(user)} holds role ${describe(role)} but has no division, so nothing is assigned`
      );
      divisionless.add(user.id);
      continue;
    }

    // an unscoped role's one row, or the copy (or the one scoped row) for their division
    const rows = targets.get(roleId);
    const target = rows?.get(null) ?? (user.divisionId ? rows?.get(user.divisionId) : undefined);
    if (target === undefined || assigned.has(`${user.id}:${target}`)) continue;
    assigned.add(`${user.id}:${target}`);
    assignments.push({
      userId: user.id,
      roleId: target,
      createdAt: later(user.createdAt, role.createdAt)
    });
  }

  const holders = new Set(assignments.map((assignment) => assignment.userId));
  for (const user of users.values()) {
    const live = user.deletedAt === null && user.status !== "suspended";
    if (!live || divisionless.has(user.id)) continue;
    if (!holders.has(user.id)) {
      error("role-less-user", `user ${describe(user)} is live but holds no role`);
    }
  }

  // Grants travel name for name; Super Admin's legacy rows are ignored in
  // favour of the whole catalogue.
  const catalogue = allPermissionKeys();
  const catalogued = new Set(catalogue);
  const grants: RbacPlan["grants"] = [];
  const granted = new Set<string>();
  const grant = (roleId: string, permissionKey: string) => {
    if (granted.has(`${roleId}:${permissionKey}`)) return;
    granted.add(`${roleId}:${permissionKey}`);
    grants.push({ roleId, permissionKey });
  };

  if (superAdmin) {
    for (const key of catalogue) grant(superAdmin.id, key);
  }
  for (const row of records(snapshot, "spatie.role_has_permissions", [
    "role_uuid",
    "permission_uuid"
  ])) {
    const roleId = row.role_uuid as string;
    const key = permissionNames.get(row.permission_uuid as string);
    if (roleId === superAdmin?.id || key === undefined || !catalogued.has(key)) continue;
    for (const target of targets.get(roleId)?.values() ?? []) grant(target, key);
  }

  // A legacy permission with no catalogue key is listed once per resource.
  const unmapped = new Map<string, string[]>();
  for (const name of permissionNames.values()) {
    if (catalogued.has(name)) continue;
    const dot = name.lastIndexOf(".");
    const resource = dot === -1 ? name : name.slice(0, dot);
    const actions = unmapped.get(resource) ?? [];
    actions.push(dot === -1 ? name : name.slice(dot + 1));
    unmapped.set(resource, actions);
  }
  for (const [resource, actions] of unmapped) {
    warning(
      "unmapped-permission",
      `${resource}: ${actions.join(", ")} ${actions.length === 1 ? "has" : "have"} no catalogue key and ${actions.length === 1 ? "is" : "are"} not carried`
    );
  }

  for (const row of records(snapshot, "spatie.model_has_permissions", [
    "permission_uuid",
    "model_id"
  ])) {
    const user = users.get(row.model_id as string);
    const permission =
      permissionNames.get(row.permission_uuid as string) ?? (row.permission_uuid as string);
    error(
      "direct-permission",
      `user ${user ? describe(user) : (row.model_id as string)} is granted ${permission} directly, which has no counterpart`
    );
  }

  return {
    roles,
    grants,
    assignments,
    findings,
    report: {
      rolesCarried: roles.length,
      rolesSplit,
      grants: grants.length,
      assignments: assignments.length,
      unmappedPermissions: [...unmapped.values()].reduce((sum, actions) => sum + actions.length, 0)
    }
  };
}

/**
 * The id of a role's copy for one division: a UUIDv5 named by the division id
 * in the namespace of the legacy role id, so every rehearsal mints the same one.
 */
export function roleCopyId(legacyRoleId: string, divisionId: string): string {
  return uuidv5(legacyRoleId, divisionId);
}

/** RFC 4122 UUIDv5: SHA-1 of the namespace's bytes and the name, version and variant set. */
export function uuidv5(namespace: string, name: string): string {
  const bytes = createHash("sha1")
    .update(Buffer.from(namespace.replace(/-/g, ""), "hex"))
    .update(name, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function insertStatements(plan: RbacPlan): string[] {
  const statements: string[] = [];

  if (plan.roles.length > 0) {
    const values = plan.roles.map((role) =>
      [
        literal(role.id),
        literal(role.name),
        literal(role.divisionId),
        orDefault(role.colorHex),
        orDefault(role.iconName),
        literal(role.description),
        orDefault(role.isActive),
        orDefault(role.isSystem),
        jakarta(role.createdAt),
        jakarta(role.updatedAt)
      ].join(", ")
    );
    statements.push(
      `insert into master.roles (id, name, division_id, color_hex, icon_name, description,
         is_active, is_system, created_at, updated_at)
       values (${values.join("),\n(")})`
    );
  }

  if (plan.grants.length > 0) {
    const values = plan.grants.map(
      (grant) => `${literal(grant.roleId)}, ${literal(grant.permissionKey)}`
    );
    statements.push(
      `insert into master.role_permissions (role_id, permission_key) values (${values.join("),\n(")})`
    );
  }

  if (plan.assignments.length > 0) {
    // legacy assignments carry no timestamp; the epoch stands in when neither
    // side has one, so a re-run still lands the same row
    const values = plan.assignments.map(
      (assignment) =>
        `${literal(assignment.userId)}, ${literal(assignment.roleId)}, coalesce(${jakarta(assignment.createdAt)}, 'epoch')`
    );
    statements.push(
      `insert into master.user_roles (user_id, role_id, created_at) values (${values.join("),\n(")})`
    );
  }

  return statements;
}

type SnapshotRecord = Record<string, string | null>;

/**
 * A snapshot table's rows keyed by column. A table the snapshot lacks has no
 * rows; one that lacks a column the transform needs is a pipeline failure.
 */
function records(snapshot: Snapshot, table: string, required: string[]): SnapshotRecord[] {
  const columns = snapshot.columns.get(table);
  if (!columns) return [];
  const absent = required.filter((column) => !columns.includes(column));
  if (absent.length > 0) {
    throw new Error(`${table}: the snapshot has no column ${absent.join(", ")}`);
  }
  return (snapshot.rows.get(table) ?? []).map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null]))
  );
}

function bool(value: string | null | undefined): boolean | null {
  if (value === null || value === undefined) return null;
  return value === "t" || value === "true";
}

function later(a: string | null, b: string | null): string | null {
  if (a === null || b === null) return a ?? b;
  return Date.parse(`${a.replace(" ", "T")}Z`) >= Date.parse(`${b.replace(" ", "T")}Z`) ? a : b;
}

function describe(subject: { id: string; name: string }): string {
  return `${subject.name} (${subject.id})`;
}

function literal(value: string | null): string {
  return value === null ? "NULL" : quoteLiteral(value);
}

function orDefault(value: string | boolean | null): string {
  if (value === null) return "DEFAULT";
  return typeof value === "boolean" ? String(value) : quoteLiteral(value);
}

/** A snapshot wall-clock as the instant it named in Jakarta, as `0022` converted the rest. */
function jakarta(wallClock: string | null): string {
  return wallClock === null
    ? "NULL"
    : `(${quoteLiteral(wallClock)}::timestamp at time zone 'Asia/Jakarta')`;
}
