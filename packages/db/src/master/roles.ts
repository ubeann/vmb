import type {
  Role,
  RoleDetail,
  RoleInput,
  RoleListRequest,
  RoleListResponse,
  RoleUpdateInput
} from "@vmb/types";
import { inCatalogueOrder, isPermissionKey } from "@vmb/types";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  or,
  sql,
  type SQL
} from "drizzle-orm";
import { divisions, roles, userRoles } from "../schema/master.js";
import {
  conflictFrom,
  countWhere,
  nextStamp,
  nullIfEmpty,
  rowsOf,
  toIso,
  unchangedSince,
  withinDays,
  type MasterDb
} from "./db.js";
import { roleOutOfReach, roleWithinReach, textArray, type Actor } from "./guards.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RuleBrokenError,
  StaleRecordError
} from "../errors.js";

/** The legacy policy refuses to modify a system role (`RolePolicy.php`). */
const SYSTEM_ROLE_MESSAGE = "System roles cannot be modified or deleted.";

// a role's columns plus how many permissions it grants, so a list needs no second query,
// and whether the caller may grant it, so a screen need not restate the rule
const roleColumns = (actor: Actor) => ({
  ...getTableColumns(roles),
  permissionCount: sql<number>`(
    select cast(count(*) as integer) from master.role_permissions rp where rp.role_id = ${roles.id}
  )`.mapWith(Number),
  grantable: sql<boolean>`${roleWithinReach(actor)}`
});

type RoleRow = typeof roles.$inferSelect & { permissionCount: number; grantable: boolean };

// a Division no role can be moved into: Inactive, or Trashed (the Inactive rule)
const divisionOutOfUse = sql`(not ${divisions.isActive} or ${divisions.deletedAt} is not null)`;

const SORT_COLUMNS = {
  name: roles.name,
  createdAt: roles.createdAt,
  updatedAt: roles.updatedAt
} as const;

const ROLE_NAME_CONFLICT = {
  master_roles_name_unique: { path: "name", message: "A role with that name already exists." }
};

function toRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    isSystem: row.isSystem,
    colorHex: row.colorHex,
    iconName: row.iconName,
    description: row.description,
    divisionId: row.divisionId,
    permissionCount: row.permissionCount,
    grantable: row.grantable,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

/** The search and every filter but the status, which the counts vary. */
function sharedConditions(query: RoleListRequest): SQL[] {
  const conditions: SQL[] = [];

  if (query.search) {
    const pattern = `%${query.search}%`;
    const matches = or(ilike(roles.name, pattern), ilike(roles.description, pattern));
    if (matches) conditions.push(matches);
  }
  const updated = withinDays(roles.updatedAt, query.updated, query.tz);
  if (updated) conditions.push(updated);
  const created = withinDays(roles.createdAt, query.created, query.tz);
  if (created) conditions.push(created);

  return conditions;
}

/** None chosen is any; both chosen is any too, but stays a condition the counts can share. */
function statusCondition(status: RoleListRequest["status"]): SQL | undefined {
  if (status.length === 0) return undefined;
  return inArray(
    roles.isActive,
    status.map((value) => value === "active")
  );
}

/**
 * A page of the list, with how many rows each Status option would give under
 * the search and the other filters (ADR-0051 rule 4), from one aggregate over
 * the rows the shared conditions match.
 */
export async function listRoles(
  db: MasterDb,
  query: RoleListRequest,
  actor: Actor
): Promise<RoleListResponse> {
  const shared = sharedConditions(query);
  const status = statusCondition(query.status);
  const column = SORT_COLUMNS[query.sort];
  const order = query.dir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select(roleColumns(actor))
      .from(roles)
      .where(and(...shared, status))
      .orderBy(order, asc(roles.name), asc(roles.id))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    db
      .select({
        total: countWhere(status),
        active: countWhere(eq(roles.isActive, true)),
        inactive: countWhere(eq(roles.isActive, false))
      })
      .from(roles)
      .where(and(...shared))
  ]);
  const counts = totals[0] ?? { total: 0, active: 0, inactive: 0 };

  return {
    items: rows.map(toRole),
    total: counts.total,
    page: query.page,
    perPage: query.perPage,
    facets: { status: { active: counts.active, inactive: counts.inactive } }
  };
}

/**
 * A role with the name of its Division, for the view, and the keys it grants,
 * for the view and the form; no Division means it applies in every Division.
 * It also counts the users who hold it, the number a change of Division moves
 * (the one `ROLE_IN_USE` names).
 */
export async function getRole(db: MasterDb, id: string, actor: Actor): Promise<RoleDetail> {
  const rows = await db
    .select({
      role: roleColumns(actor),
      divisionName: divisions.name,
      divisionInactive: sql<boolean>`${divisions.id} is not null and ${divisionOutOfUse}`,
      userCount: sql<number>`(
        select cast(count(*) as integer) from master.user_roles ur where ur.role_id = ${roles.id}
      )`.mapWith(Number),
      permissionKeys: sql<string[]>`coalesce((
        select json_agg(rp.permission_key)
          from master.role_permissions rp where rp.role_id = ${roles.id}
      ), '[]'::json)`
    })
    .from(roles)
    .leftJoin(divisions, eq(divisions.id, roles.divisionId))
    .where(eq(roles.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("Role not found.");
  // the count is the keys read here, so the grants are scanned once
  const permissionKeys = inCatalogueOrder(row.permissionKeys);
  return {
    ...toRole({ ...row.role, permissionCount: permissionKeys.length }),
    divisionName: row.divisionName,
    divisionInactive: row.divisionInactive,
    userCount: row.userCount,
    permissionKeys
  };
}

/**
 * The keys a save grants, once each and sorted, if the caller may grant them
 * all: a key the catalogue does not define is a 404, and one the caller does
 * not hold a 403, before anything is written. The catalogue is the code's
 * (ADR-0045), and a test holds `master.permissions` to it.
 */
function grantable(keys: readonly string[], actor: Actor): string[] {
  const unique = inCatalogueOrder([...new Set(keys)]);
  if (!unique.every(isPermissionKey)) {
    throw new NotFoundError("One of the chosen permissions does not exist.");
  }
  const held = new Set(actor.permissions);
  if (unique.some((key) => !held.has(key))) {
    throw new ForbiddenError(
      "PERMISSION_ESCALATION",
      "You cannot grant a permission you do not have."
    );
  }
  return unique;
}

/**
 * Whether a save may put a role in `divisionId`: it exists (404 on the field),
 * and is not Inactive or Trashed, which no role can be moved into (400 on the
 * field, the Inactive rule). A role that is already in the Division keeps it
 * whatever its state became, so `current` passes; so do every, `null`, and an
 * edit that does not mention it, `undefined`.
 */
async function assertDivisionChoosable(
  db: MasterDb,
  divisionId: string | null | undefined,
  current: string | null = null
): Promise<void> {
  if (divisionId === undefined || divisionId === null) return;
  if (divisionId.toLowerCase() === current?.toLowerCase()) return;

  const rows = await db
    .select({
      name: divisions.name,
      unusable: sql<boolean>`${divisionOutOfUse}`
    })
    .from(divisions)
    .where(eq(divisions.id, divisionId))
    .limit(1);
  const found = rows[0];
  if (!found) throw new NotFoundError("That division no longer exists.", "divisionId");
  if (found.unusable) {
    throw new RuleBrokenError(
      `“${found.name}” is an Inactive Division, so a role cannot be moved into it. Choose an active one.`,
      "divisionId"
    );
  }
}

/**
 * What a raw role statement returns, under the names a `Role` has. The stamps
 * are formatted in SQL, so every driver hands back the same ISO string the
 * query builder's would; `permissionCount` is the grants once it is written.
 * A role the caller just created or edited is grantable: both statements hold
 * it to the caller's own permissions.
 */
function returnedRole(permissionCount: SQL): SQL {
  const iso = (column: string) =>
    sql.raw(`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);
  return sql`r.id, r.name, r.is_active as "isActive", r.is_system as "isSystem",
    r.color_hex as "colorHex", r.icon_name as "iconName", r.description,
    r.division_id as "divisionId", ${permissionCount} as "permissionCount",
    true as "grantable",
    ${iso("r.created_at")} as "createdAt", ${iso("r.updated_at")} as "updatedAt"`;
}

// a driver may hand an integer back as a string
type ReturnedRole = Omit<Role, "permissionCount"> & { permissionCount: number | string };

function fromReturned(row: ReturnedRole): Role {
  return { ...row, permissionCount: Number(row.permissionCount) };
}

/**
 * Create a role and its grants in one statement, so a role never exists
 * without the grants it was saved with. The caller may grant only keys they
 * hold (ADR-0045's amendment of 2026-10-17).
 */
export async function createRole(db: MasterDb, input: RoleInput, actor: Actor): Promise<Role> {
  const keys = grantable(input.permissionKeys ?? [], actor);
  await assertDivisionChoosable(db, input.divisionId);

  try {
    const result = await db.execute(sql`
      with r as (
        insert into master.roles
          (name, description, color_hex, icon_name, is_active, is_system, division_id,
           created_at, updated_at)
        values (${input.name}, ${nullIfEmpty(input.description)}, ${input.colorHex},
                ${input.iconName}, ${input.isActive}, false, ${input.divisionId ?? null},
                now(), now())
        returning *
      ), granted as (
        insert into master.role_permissions (role_id, permission_key)
        select r.id, key from r cross join unnest(${textArray(keys)}) as key
        returning 1
      )
      select ${returnedRole(sql`${keys.length}`)} from r
    `);
    const row = rowsOf<ReturnedRole>(result)[0];
    if (!row) throw new Error("creating a role returned no row");
    return fromReturned(row);
  } catch (error) {
    return conflictFrom(error, ROLE_NAME_CONFLICT);
  }
}

/**
 * Save an edit, if the role is still as the editor loaded it and the caller
 * may change it. One statement writes the role's fields and, when
 * `permissionKeys` is given, replaces its grants with that set. Its `where`
 * carries the stale check and the reach test (the role grants nothing the
 * caller lacks), so neither a save nor a grant landing after the check ahead
 * of it can be overwritten, or widened past the caller (ADR-0045's amendment
 * of 2026-10-17). The check ahead answers first with its own message; a write
 * that still matches no row reads once more to say why: 404, 403, then 409.
 *
 * Every grant the app writes goes through this statement or `createRole`, and
 * this one updates the role's row first: a concurrent save of the same role
 * waits on that row's lock, then fails the stale check, so two saves cannot
 * interleave their grants. What stays open is a grant written outside the
 * app (the legacy import) inside this statement's own snapshot, the window
 * ADR-0045's amendment of 2026-10-12 accepts for the user writes.
 */
export async function updateRole(
  db: MasterDb,
  id: string,
  input: RoleUpdateInput,
  actor: Actor
): Promise<Role> {
  const current = await assertEditable(db, id, actor);
  const { updatedAt, permissionKeys, ...fields } = input;
  await assertDivisionChoosable(db, fields.divisionId, current.divisionId);
  // the role grants nothing the caller lacks, so this also covers what a save revokes
  const keys = permissionKeys === undefined ? undefined : grantable(permissionKeys, actor);

  // omitted keys leave the grants alone, and the count is the stored one
  const grants =
    keys === undefined
      ? sql``
      : sql`, revoked as (
          delete from master.role_permissions
           where role_id = (select id from r) and permission_key <> all(${textArray(keys)})
          returning 1
        ), granted as (
          insert into master.role_permissions (role_id, permission_key)
          select r.id, key from r cross join unnest(${textArray(keys)}) as key
          on conflict do nothing
          returning 1
        )`;
  const permissionCount =
    keys === undefined
      ? sql`(select cast(count(*) as integer) from master.role_permissions rp where rp.role_id = r.id)`
      : sql`${keys.length}`;

  try {
    const result = await db.execute(sql`
      with r as (
        update master.roles
           set name = ${fields.name},
               description = ${nullIfEmpty(fields.description)},
               color_hex = ${fields.colorHex},
               icon_name = ${fields.iconName},
               is_active = ${fields.isActive},
               division_id = ${fields.divisionId === undefined ? sql.raw("division_id") : fields.divisionId},
               updated_at = ${nextStamp(roles.updatedAt)}
         where id = ${id} and not is_system and ${unchangedSince(roles.updatedAt, updatedAt)}
           and ${roleWithinReach(actor)}
        returning *
      )${grants}
      select ${returnedRole(permissionCount)} from r
    `);
    const row = rowsOf<ReturnedRole>(result)[0];
    if (row) return fromReturned(row);
  } catch (error) {
    return conflictFrom(error, ROLE_NAME_CONFLICT);
  }

  // the check found the role a moment ago: it is gone, out of reach, or changed since
  await assertEditable(db, id, actor);
  throw new StaleRecordError();
}

export async function deleteRole(db: MasterDb, id: string): Promise<void> {
  await assertEditable(db, id);

  // a role in use is refused, not cascaded: deleting it would strip access
  // from everyone who holds it (the foreign key is the backstop)
  const holders = await db
    .select({ value: count() })
    .from(userRoles)
    .where(eq(userRoles.roleId, id));
  const held = holders[0]?.value ?? 0;
  if (held > 0) {
    throw new ConflictError(
      `${held} ${held === 1 ? "user holds" : "users hold"} this role. Remove it from them first.`,
      { code: "ROLE_IN_USE" }
    );
  }

  const rows = await db
    .delete(roles)
    .where(and(eq(roles.id, id), eq(roles.isSystem, false)))
    .returning({ id: roles.id });

  if (!rows[0]) throw new NotFoundError("Role not found.");
}

/**
 * Whether this role may be changed, in one read: it exists (404) and is not a
 * System Role (403 `SYSTEM_ROLE`). Given an `actor`, an edit, it also grants
 * nothing the caller lacks (403 `PERMISSION_ESCALATION`); a delete passes none,
 * since the reach rule is about editing (ADR-0045's amendment of 2026-10-17).
 * It returns the role's Division, which the Inactive rule compares a save with.
 */
async function assertEditable(
  db: MasterDb,
  id: string,
  actor?: Actor
): Promise<{ divisionId: string | null }> {
  const rows = await db
    .select({
      isSystem: roles.isSystem,
      divisionId: roles.divisionId,
      inReach: actor ? sql<boolean>`${roleWithinReach(actor)}` : sql<boolean>`true`
    })
    .from(roles)
    .where(eq(roles.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw new NotFoundError("Role not found.");
  if (row.isSystem) throw new ForbiddenError("SYSTEM_ROLE", SYSTEM_ROLE_MESSAGE);
  if (!row.inReach) throw roleOutOfReach();
  return { divisionId: row.divisionId };
}
