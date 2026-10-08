import type { Role, RoleInput, RoleListQuery, RoleListResponse } from "@vmb/types";
import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { roles, userRoles } from "../schema/master.js";
import { conflictFrom, nullIfEmpty, toIso, type MasterDb } from "./db.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.js";

/** The legacy policy refuses to modify a system role (`RolePolicy.php`). */
const SYSTEM_ROLE_MESSAGE = "System roles cannot be modified or deleted.";

type RoleRow = typeof roles.$inferSelect;

const SORT_COLUMNS = {
  name: roles.name,
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

function whereFor(query: RoleListQuery) {
  const conditions: SQL[] = [];

  if (query.active === "active") conditions.push(eq(roles.isActive, true));
  if (query.active === "inactive") conditions.push(eq(roles.isActive, false));
  if (query.search) {
    const pattern = `%${query.search}%`;
    const matches = or(ilike(roles.name, pattern), ilike(roles.description, pattern));
    if (matches) conditions.push(matches);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listRoles(db: MasterDb, query: RoleListQuery): Promise<RoleListResponse> {
  const where = whereFor(query);
  const column = SORT_COLUMNS[query.sort];
  const order = query.dir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(roles)
      .where(where)
      .orderBy(order, asc(roles.name))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    db.select({ value: count() }).from(roles).where(where)
  ]);

  return {
    items: rows.map(toRole),
    total: totals[0]?.value ?? 0,
    page: query.page,
    perPage: query.perPage
  };
}

export async function getRole(db: MasterDb, id: string): Promise<Role> {
  const rows = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("Role not found.");
  return toRole(row);
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

export async function updateRole(db: MasterDb, id: string, input: RoleInput): Promise<Role> {
  await assertMutable(db, id);

  try {
    const rows = await db
      .update(roles)
      .set({ ...input, description: nullIfEmpty(input.description), updatedAt: new Date() })
      .where(and(eq(roles.id, id), eq(roles.isSystem, false)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundError("Role not found.");
    return toRole(row);
  } catch (error) {
    return conflictFrom(error, ROLE_NAME_CONFLICT);
  }
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
