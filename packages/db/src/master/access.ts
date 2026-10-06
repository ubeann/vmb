import type { Access } from "@vmb/types";
import { and, asc, eq, isNull } from "drizzle-orm";
import { divisions, rolePermissions, roles, userRoles, users } from "../schema/master.js";
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

  const own = await db
    .select({ id: divisions.id, name: divisions.name, iconName: divisions.iconName })
    .from(users)
    .innerJoin(divisions, and(eq(divisions.id, users.divisionId), isNull(divisions.deletedAt)))
    .where(eq(users.id, userId));

  return { permissions: granted.map((row) => row.key), divisions: own };
}
