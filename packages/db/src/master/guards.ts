import { and, eq, inArray } from "drizzle-orm";
import { rolePermissions, roles, userRoles } from "../schema/master.js";
import type { MasterDb } from "./db.js";
import { ForbiddenError, NotFoundError } from "../errors.js";

/**
 * Who is making a change: their id, and the permissions `requirePermission`
 * already read for them in this request. The guards below take these rather
 * than reading the caller's access again (ADR-0045's amendment).
 */
export type Actor = { id: string; permissions: readonly string[] };

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
 * Whether a caller holding `held` may add or remove these roles. Changing who holds a role
 * is granting its permissions, so a caller may only change roles whose every
 * permission they hold themselves: nobody can hand out, or take away, more than
 * they have. A role with no permissions is always changeable.
 */
export async function assertCanChangeRoles(
  db: MasterDb,
  held: readonly string[],
  changed: string[]
) {
  if (changed.length === 0) return;

  const found = await db.select({ id: roles.id }).from(roles).where(inArray(roles.id, changed));
  if (found.length !== changed.length) {
    throw new NotFoundError("One of the chosen roles no longer exists.");
  }

  const needed = await grantedBy(db, changed);
  const mine = new Set(held);

  if (needed.some((key) => !mine.has(key))) {
    throw new ForbiddenError(
      "PERMISSION_ESCALATION",
      "You cannot change a role that carries permissions you do not have."
    );
  }
}

/**
 * Whether `actor` may edit, suspend, delete or restore this user. A user who
 * holds permissions the caller lacks is out of the caller's reach: otherwise
 * `master-users.update` alone would let anyone reset a Super Admin's password
 * and sign in as them. People may always edit themselves.
 */
export async function assertCanManageUser(db: MasterDb, actor: Actor, targetId: string) {
  if (actor.id.toLowerCase() === targetId.toLowerCase()) return;

  const held = await db
    .select({ id: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
    .where(eq(userRoles.userId, targetId));
  const needed = await grantedBy(
    db,
    held.map((row) => row.id)
  );
  const mine = new Set(actor.permissions);

  if (needed.some((key) => !mine.has(key))) {
    throw new ForbiddenError(
      "PERMISSION_ESCALATION",
      "You cannot change a user who holds permissions you do not have."
    );
  }
}
