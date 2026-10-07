import { and, eq, inArray } from "drizzle-orm";
import { rolePermissions, roles, userRoles } from "../schema/master.js";
import { getAccess } from "./access.js";
import type { MasterDb } from "./db.js";
import { ForbiddenError, NotFoundError } from "../errors.js";

/** Ids once each and lower-cased, the way Postgres reads a uuid. */
export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

export async function currentRoleIds(db: MasterDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((row) => row.id);
}

/** The permission keys these roles grant, once each. */
async function grantedBy(db: MasterDb, roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ key: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds));
  return rows.map((row) => row.key);
}

/**
 * Whether `actorId` may add or remove these roles. Changing who holds a role
 * is granting its permissions, so a caller may only change roles whose every
 * permission they hold themselves: nobody can hand out, or take away, more than
 * they have. A role with no permissions is always changeable.
 */
export async function assertCanChangeRoles(db: MasterDb, actorId: string, changed: string[]) {
  if (changed.length === 0) return;

  const found = await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, changed));
  if (found.length !== changed.length) {
    throw new NotFoundError("One of the chosen roles no longer exists.");
  }

  const [needed, actor] = await Promise.all([grantedBy(db, changed), getAccess(db, actorId)]);
  const held = new Set(actor.permissions);

  if (needed.some((key) => !held.has(key))) {
    throw new ForbiddenError(
      "PERMISSION_ESCALATION",
      "You cannot change a role that carries permissions you do not have."
    );
  }
}

/**
 * Whether `actorId` may edit, suspend, delete or restore this user. A user who
 * holds permissions the caller lacks is out of the caller's reach: otherwise
 * `master-users.update` alone would let anyone reset a Super Admin's password
 * and sign in as them. People may always edit themselves.
 */
export async function assertCanManageUser(db: MasterDb, actorId: string, targetId: string) {
  if (actorId.toLowerCase() === targetId.toLowerCase()) return;

  const held = await db
    .select({ id: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
    .where(eq(userRoles.userId, targetId));
  const [needed, actor] = await Promise.all([
    grantedBy(
      db,
      held.map((row) => row.id)
    ),
    getAccess(db, actorId)
  ]);
  const mine = new Set(actor.permissions);

  if (needed.some((key) => !mine.has(key))) {
    throw new ForbiddenError(
      "PERMISSION_ESCALATION",
      "You cannot change a user who holds permissions you do not have."
    );
  }
}
