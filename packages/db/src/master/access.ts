import type { Access } from "@vmb/types";
import { and, asc, eq, isNull } from "drizzle-orm";
import { divisions, rolePermissions, roles, userRoles } from "../schema/master.js";
import type { MasterDb } from "./db.js";

/**
 * What a user may do: the union of the permissions granted by their active
 * roles. Nothing here can subtract, and an inactive role grants nothing.
 */
export async function getAccess(db: MasterDb, userId: string): Promise<Access> {
  const granted = await db
    .selectDistinct({ key: rolePermissions.permissionKey })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(rolePermissions.permissionKey));

  // the divisions the user's active roles are scoped to; a role with none
  // (Super Admin) is scoped to all of them and names no division
  const own = await db
    .selectDistinct({ id: divisions.id, name: divisions.name, iconName: divisions.iconName })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
    .innerJoin(divisions, and(eq(divisions.id, roles.divisionId), isNull(divisions.deletedAt)))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(divisions.name));

  return { permissions: granted.map((row) => row.key), divisions: own };
}
