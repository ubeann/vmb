import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { rolePermissions, roles, userRoles, users } from "../schema/master.js";
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
  if (isSelf(actor, targetId)) return;

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

  if (needed.some((key) => !mine.has(key))) throw outOfReach();
}

/** The refusal for a user holding permissions the caller lacks. */
export function outOfReach() {
  return new ForbiddenError(
    "PERMISSION_ESCALATION",
    "You cannot change a user who holds permissions you do not have."
  );
}

/**
 * `assertCanManageUser`'s test as a condition of the statement that writes: the
 * user in `target` holds, through their active roles, no permission outside
 * `actor`'s. The check ahead of a write reads, and a role granted after that
 * read lands on a user the caller may no longer manage; this one is decided
 * inside the write itself, as `deleted_at is null` is (ADR-0055). It is not
 * true for a caller's own user, which the guard lets through. It reads the
 * user's id from `master.users`, so it belongs in a statement that writes or
 * selects that table.
 */
export function withinReach(actor: Actor, targetId: string): SQL {
  if (isSelf(actor, targetId)) return sql`true`;

  const held =
    actor.permissions.length === 0
      ? sql`array[]::text[]`
      : sql`array[${sql.join(
          actor.permissions.map((key) => sql`${key}`),
          sql`, `
        )}]::text[]`;

  return sql`not exists (
    select 1
      from master.user_roles ur
      join master.roles r on r.id = ur.role_id and r.is_active
      join master.role_permissions rp on rp.role_id = r.id
     where ur.user_id = ${users.id} and rp.permission_key <> all(${held})
  )`;
}

/** Whether the caller is changing their own user, whom the reach rule never refuses. */
function isSelf(actor: Actor, targetId: string): boolean {
  return actor.id.toLowerCase() === targetId.toLowerCase();
}
