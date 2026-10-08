import type { Access } from "@vmb/types";
import { and, asc, eq, isNull } from "drizzle-orm";
import { divisions, rolePermissions, roles, userRoles, users } from "../schema/master.js";
import type { MasterDb } from "./db.js";

// A session that outlives its user's suspension or deletion keeps nothing:
// only an Active, not-Trashed user holds permissions or belongs to a division.
// The gate stops new sessions; this closes the window for one that survives a
// failed revoke. Both reads start from the user row so each stays one statement.
const holdsAccess = (userId: string) =>
  and(eq(users.id, userId), eq(users.status, "active"), isNull(users.deletedAt));

/**
 * What a user may do, in one statement: the union of the permissions granted
 * by their active roles, sorted. Nothing here can subtract, and an inactive
 * role grants nothing. This is the read `requirePermission` makes once per
 * request (ADR-0045's amendment); nothing keeps it beyond that request.
 */
export async function getPermissions(db: MasterDb, userId: string): Promise<string[]> {
  const granted = await db
    .selectDistinct({ key: rolePermissions.permissionKey })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(holdsAccess(userId))
    .orderBy(asc(rolePermissions.permissionKey));

  return granted.map((row) => row.key);
}

/** The caller's permissions and divisions, for `GET /api/me`; the two reads run in parallel. */
export async function getAccess(db: MasterDb, userId: string): Promise<Access> {
  // the divisions the user's active roles are scoped to; a role with none
  // (Super Admin) is scoped to all of them and names no division
  const [permissions, own] = await Promise.all([
    getPermissions(db, userId),
    db
      .selectDistinct({ id: divisions.id, name: divisions.name, iconName: divisions.iconName })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
      .innerJoin(divisions, and(eq(divisions.id, roles.divisionId), isNull(divisions.deletedAt)))
      .where(holdsAccess(userId))
      .orderBy(asc(divisions.name))
  ]);

  return { permissions, divisions: own };
}
