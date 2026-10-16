import type {
  Role,
  RoleDetail,
  RoleInput,
  RoleListRequest,
  RoleListResponse,
  RoleUpdateInput
} from "@vmb/types";
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { divisions, roles, userRoles } from "../schema/master.js";
import {
  conflictFrom,
  countWhere,
  nextStamp,
  nullIfEmpty,
  toIso,
  unchangedSince,
  withinDays,
  type MasterDb
} from "./db.js";
import { ConflictError, ForbiddenError, NotFoundError, StaleRecordError } from "../errors.js";

/** The legacy policy refuses to modify a system role (`RolePolicy.php`). */
const SYSTEM_ROLE_MESSAGE = "System roles cannot be modified or deleted.";

type RoleRow = typeof roles.$inferSelect;

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
export async function listRoles(db: MasterDb, query: RoleListRequest): Promise<RoleListResponse> {
  const shared = sharedConditions(query);
  const status = statusCondition(query.status);
  const column = SORT_COLUMNS[query.sort];
  const order = query.dir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select()
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

/** A role with the name of its Division, for the view; none means it applies in every Division. */
export async function getRole(db: MasterDb, id: string): Promise<RoleDetail> {
  const rows = await db
    .select({ role: roles, divisionName: divisions.name })
    .from(roles)
    .leftJoin(divisions, eq(divisions.id, roles.divisionId))
    .where(eq(roles.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("Role not found.");
  return { ...toRole(row.role), divisionName: row.divisionName };
}

export async function createRole(db: MasterDb, input: RoleInput): Promise<Role> {
  try {
    const stamp = new Date();
    const rows = await db
      .insert(roles)
      .values({
        ...input,
        description: nullIfEmpty(input.description),
        isSystem: false,
        createdAt: stamp,
        updatedAt: stamp
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("creating a role returned no row");
    return toRole(row);
  } catch (error) {
    return conflictFrom(error, ROLE_NAME_CONFLICT);
  }
}

/**
 * Save an edit, if the role is still as the editor loaded it: `input.updatedAt`
 * is compared inside the update, so nothing saved since can be overwritten. A
 * miss is a 409 when the role exists and a 404 when it does not.
 */
export async function updateRole(db: MasterDb, id: string, input: RoleUpdateInput): Promise<Role> {
  await assertMutable(db, id);
  const { updatedAt, ...fields } = input;

  try {
    const rows = await db
      .update(roles)
      .set({
        ...fields,
        description: nullIfEmpty(fields.description),
        updatedAt: nextStamp(roles.updatedAt)
      })
      .where(
        and(eq(roles.id, id), eq(roles.isSystem, false), unchangedSince(roles.updatedAt, updatedAt))
      )
      .returning();
    const row = rows[0];
    if (row) return toRole(row);
  } catch (error) {
    return conflictFrom(error, ROLE_NAME_CONFLICT);
  }

  // `assertMutable` found the role a moment ago: it is gone, or changed since
  await assertMutable(db, id);
  throw new StaleRecordError();
}

export async function deleteRole(db: MasterDb, id: string): Promise<void> {
  await assertMutable(db, id);

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

async function assertMutable(db: MasterDb, id: string): Promise<void> {
  const rows = await db
    .select({ isSystem: roles.isSystem })
    .from(roles)
    .where(eq(roles.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw new NotFoundError("Role not found.");
  if (row.isSystem) throw new ForbiddenError("SYSTEM_ROLE", SYSTEM_ROLE_MESSAGE);
}
