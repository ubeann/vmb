import type {
  User,
  UserCreateInput,
  UserListQuery,
  UserListResponse,
  UserStatus,
  UserUpdateInput
} from "@vmb/types";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL
} from "drizzle-orm";
import { session as authSession, user as authUser } from "../schema/auth.js";
import { users } from "../schema/master.js";
import {
  assertCanChangeRoles,
  assertCanManageUser,
  currentRoleIds,
  outOfReach,
  uniqueIds,
  withinReach,
  type Actor
} from "./guards.js";
import {
  conflictFrom,
  nextStamp,
  nullIfEmpty,
  rowsOf,
  toIso,
  unchangedSince,
  type MasterDb,
  type OpenTransaction
} from "./db.js";
import { NotFoundError, StaleRecordError } from "../errors.js";

// A user's columns plus whether Better Auth has verified the email: the
// identity owns verification (ADR-0032), so it is read from there rather than
// kept as a second copy on the business row.
const userColumns = {
  ...getTableColumns(users),
  emailVerified: sql<boolean>`coalesce(${authUser.emailVerified}, false)`,
  // the roles the user holds, by name, so a list needs no second query
  roles: sql<Array<{ id: string; name: string }>>`coalesce((
    select json_agg(json_build_object('id', r.id, 'name', r.name) order by r.name)
      from master.user_roles ur join master.roles r on r.id = ur.role_id
     where ur.user_id = ${users.id}
  ), '[]'::json)`
};

type UserRow = typeof users.$inferSelect & {
  emailVerified: boolean;
  roles: Array<{ id: string; name: string }>;
};

function selectUsers(db: MasterDb) {
  return db
    .select(userColumns)
    .from(users)
    .leftJoin(authUser, sql`${authUser.id} = ${users.id}::text`);
}

export type UserStoreOptions = {
  hashPassword: (password: string) => Promise<string>;
  /** Opens the transactions a use case needs (ADR-0049); see `OpenTransaction`. */
  transaction: OpenTransaction;
};

const SORT_COLUMNS = {
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
} as const;

const EMAIL_TAKEN = { path: "email", message: "A user with that email already exists." };
const EMAIL_CONFLICT = {
  master_users_email_unique: EMAIL_TAKEN,
  user_email_unique: EMAIL_TAKEN
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    status: row.status as UserStatus,
    roles: row.roles,
    phone: row.phone,
    email: row.email,
    emailVerified: row.emailVerified,
    profilePhotoPath: row.profilePhotoPath,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    deletedAt: toIso(row.deletedAt)
  };
}

function whereFor(query: UserListQuery) {
  const conditions: SQL[] = [];

  if (query.trashed === "exclude") conditions.push(isNull(users.deletedAt));
  if (query.trashed === "only") conditions.push(isNotNull(users.deletedAt));
  if (query.status !== "all") conditions.push(eq(users.status, query.status));
  if (query.divisionId) {
    // a user belongs to the divisions their roles are scoped to
    conditions.push(sql`exists (
      select 1 from master.user_roles ur join master.roles r on r.id = ur.role_id
       where ur.user_id = ${users.id} and r.division_id = ${query.divisionId}
    )`);
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    const matches = or(
      ilike(users.name, pattern),
      ilike(users.email, pattern),
      ilike(users.phone, pattern)
    );
    if (matches) conditions.push(matches);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listUsers(db: MasterDb, query: UserListQuery): Promise<UserListResponse> {
  const where = whereFor(query);
  const column = SORT_COLUMNS[query.sort];
  const order = query.dir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    selectUsers(db)
      .where(where)
      .orderBy(order, asc(users.id))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    db.select({ value: count() }).from(users).where(where)
  ]);

  return {
    items: rows.map(toUser),
    total: totals[0]?.value ?? 0,
    page: query.page,
    perPage: query.perPage
  };
}

export async function getUser(db: MasterDb, id: string): Promise<User> {
  const rows = await selectUsers(db).where(eq(users.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("User not found.");
  return toUser(row);
}

/**
 * What the sign-in gate reads (#7): `deletedAt` is the soft-delete marker,
 * `status` is Active, Suspended or Inactive, and `null` means the user has no
 * business record at all. Only an Active, not-Trashed user may hold a session.
 */
export type SignInEligibility = { deletedAt: string | null; status: UserStatus } | null;

/**
 * The sign-in gate's lookup (ADR-0033): whether a session may exist at all for
 * this user. Missing rows and DB failures are the caller's to interpret; this
 * returns `null` only for a user that is not there.
 */
export async function getSignInEligibility(db: MasterDb, id: string): Promise<SignInEligibility> {
  const rows = await db
    .select({ deletedAt: users.deletedAt, status: users.status })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { deletedAt: toIso(row.deletedAt), status: row.status as UserStatus };
}

/** A SQL `uuid[]` for a list of ids, empty included. */
function uuidArray(ids: string[]) {
  if (ids.length === 0) return sql`array[]::uuid[]`;
  return sql`array[${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )}]::uuid[]`;
}

export async function createUser(
  db: MasterDb,
  options: UserStoreOptions,
  input: UserCreateInput,
  actor: Actor
): Promise<User> {
  const roleIds = uniqueIds(input.roleIds);
  await assertCanChangeRoles(db, actor.permissions, roleIds);

  const id = crypto.randomUUID();
  const passwordHash = await options.hashPassword(input.password);

  try {
    // One statement, so either the business row, the Better Auth identity and
    // its credential all land, or none does: the Neon HTTP driver has no
    // interactive transactions, but a single CTE is atomic on any Postgres.
    await db.execute(sql`
      with business_user as (
        insert into master.users
          (id, name, status, phone, email, profile_photo_path, created_at, updated_at)
        values
          (${id}, ${input.name}, ${input.status}, ${input.phone}, ${input.email},
           ${nullIfEmpty(input.profilePhotoPath)}, now(), now())
        returning id
      ), auth_user as (
        insert into public."user" (id, name, email, email_verified, image, created_at, updated_at)
        select id, ${input.name}, ${input.email}, false, ${nullIfEmpty(input.profilePhotoPath)}, now(), now()
          from business_user
        returning id
      ), assigned as (
        insert into master.user_roles (user_id, role_id)
        select ${id}::uuid, r from unnest(${uuidArray(roleIds)}) as r
        returning 1
      )
      insert into public.account
        (id, account_id, provider_id, user_id, password, created_at, updated_at)
      select ${crypto.randomUUID()}, id, 'credential', id, ${passwordHash}, now(), now()
        from auth_user
    `);
  } catch (error) {
    return conflictFrom(error, EMAIL_CONFLICT);
  }

  return getUser(db, id);
}

/**
 * Whether the role sets differ. Both are lower-cased ids, once each, as
 * `uniqueIds` and Postgres give them.
 */
function sameRoles(next: string[], before: string[]): boolean {
  return next.length === before.length && next.every((role) => before.includes(role));
}

/**
 * A save's role writes, as CTEs of the statement that writes the user: each
 * reads `business_user`, so a refused save (Trashed, stale, a duplicate email)
 * leaves the roles alone too. The change is applied as exactly what was
 * checked: a role someone else grants between the check and the write is not
 * removed by this save.
 */
function roleSync(id: string, added: string[], removed: string[]): SQL {
  return sql`, role_removal as (
      delete from master.user_roles
       where user_id = ${id}::uuid and role_id = any(${uuidArray(removed)})
         and exists (select 1 from business_user)
      returning 1
    ), role_addition as (
      insert into master.user_roles (user_id, role_id)
      select ${id}::uuid, r from unnest(${uuidArray(added)}) as r
       where exists (select 1 from business_user)
      on conflict do nothing
      returning 1
    )`;
}

/**
 * Save an edit, if the user is live and still as the editor loaded it. A
 * Trashed user is read-only until restored (ADR-0055): the writing statement's
 * own `where` refuses one, so nothing read beforehand can let a delete slip
 * past, and it is answered as a missing user where a live user that changed
 * since is a 409.
 */
export async function updateUser(
  db: MasterDb,
  options: UserStoreOptions,
  id: string,
  input: UserUpdateInput,
  actor: Actor
): Promise<User> {
  // Before any transaction opens, so it holds its connection only for SQL.
  const passwordHash =
    input.password === "" ? undefined : await options.hashPassword(input.password);

  // No `roleIds` means "leave the roles alone"; a list is the whole new set.
  // A save that keeps the set the user already holds (the form always sends
  // it) writes no roles, so it needs no transaction and stays on the cached
  // HTTP driver.
  const next = input.roleIds === undefined ? undefined : uniqueIds(input.roleIds);
  if (next === undefined || sameRoles(next, await currentRoleIds(db, id))) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    if (!existing[0]) throw new NotFoundError("User not found.");

    await assertCanManageUser(db, actor, id);
    try {
      // the check above answers first with its own message; the reach test in
      // the write closes the window after it (ADR-0055)
      await writeUser(db, id, input, passwordHash, sql``, actor, withinReach(actor, id));
    } catch (error) {
      return conflictFrom(error, EMAIL_CONFLICT);
    }
  } else {
    try {
      // The checks and the write they guard commit together or not at all,
      // and the lock on the user's row makes a concurrent role change on the
      // same user wait for this one: it then checks what this one wrote,
      // rather than what was there before (ADR-0045's race, closed by
      // ADR-0049). A Trashed user is refused here, before any check runs.
      await options.transaction(async (tx) => {
        const locked = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, id), isNull(users.deletedAt)))
          .for("update");
        if (!locked[0]) throw new NotFoundError("User not found.");

        await assertCanManageUser(tx, actor, id);

        const before = await currentRoleIds(tx, id);
        const added = next.filter((role) => !before.includes(role));
        const removed = before.filter((role) => !next.includes(role));
        await assertCanChangeRoles(tx, actor.permissions, [...added, ...removed]);

        // the row lock above already holds the target's roles still
        await writeUser(
          tx,
          id,
          input,
          passwordHash,
          roleSync(id, added, removed),
          actor,
          sql`true`
        );
      });
    } catch (error) {
      return conflictFrom(error, EMAIL_CONFLICT);
    }
  }

  // The gate reads status when a session is created; ending the current ones
  // closes the window for cookies already issued, as deleting a user does.
  if (input.status !== "active") {
    await db.delete(authSession).where(eq(authSession.userId, id));
  }

  return getUser(db, id);
}

/**
 * Write a user's own fields, with their Better Auth identity, given a hash
 * their credential, and the save's role CTEs, in one statement. `where id = …
 * and deleted_at is null and <unchanged since>` is the Trash and stale check,
 * inside the statement that writes: when it matches no row nothing in the
 * statement changes (the role sync and the identity writes all read
 * `business_user`), and this throws: 404 for a user gone or Trashed since the
 * checks before it, 403 for one another caller's role grant put out of the
 * editor's reach since, 409 for one that changed since the editor loaded it.
 * `reach` is the reach test for that `where`; a save that changes roles passes
 * `true`, since it holds the user's row lock instead.
 */
async function writeUser(
  db: MasterDb,
  id: string,
  input: UserUpdateInput,
  passwordHash: string | undefined,
  roles: SQL,
  actor: Actor,
  reach: SQL
): Promise<void> {
  const photo = nullIfEmpty(input.profilePhotoPath);
  const unchanged = unchangedSince(users.updatedAt, input.updatedAt);
  const stamp = sql`${unchanged} and ${reach}`;
  const result =
    passwordHash === undefined
      ? await writeFields(db, id, input, photo, stamp, roles)
      : await writeFieldsAndCredential(db, id, input, photo, stamp, passwordHash, roles);

  if (rowsOf(result).length === 0) {
    throw await whyNotWritten(db, actor, id, () => new StaleRecordError());
  }
}

/**
 * Why a write that matched no row did: only the wording of the refusal comes
 * from this read, the write itself was decided in its own statement. In this
 * order: the user is gone or Trashed (404), the caller's reach no longer
 * covers them (403), or else they changed since the editor loaded them, which
 * is `stale`.
 */
async function whyNotWritten(db: MasterDb, actor: Actor, id: string, stale: () => Error) {
  const rows = await db
    .select({
      deletedAt: users.deletedAt,
      inReach: sql<boolean>`${withinReach(actor, id)}`
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const row = rows[0];

  if (!row || row.deletedAt) return new NotFoundError("User not found.");
  if (!row.inReach) return outOfReach();
  return stale();
}

function writeFields(
  db: MasterDb,
  id: string,
  input: UserUpdateInput,
  photo: string | null,
  stamp: SQL,
  roles: SQL
) {
  // One statement, so an existing Better Auth identity cannot drift from
  // the business row when either side refuses the change (a duplicate
  // email, most likely). An identity that does not exist yet is #7's
  // transform to create.
  return db.execute(sql`
    with business_user as (
      update master.users
         set name = ${input.name},
             status = ${input.status},
             phone = ${input.phone},
             email = ${input.email},
             profile_photo_path = ${photo},
             updated_at = ${nextStamp(users.updatedAt)}
       where id = ${id} and deleted_at is null and ${stamp}
      returning id
    ), auth_update as (
      update public."user"
         set name = ${input.name},
             email = ${input.email},
             image = ${photo},
             updated_at = now()
       where id = (select id::text from business_user)
      returning id
    )${roles}
    select id from business_user
  `);
}

function writeFieldsAndCredential(
  db: MasterDb,
  id: string,
  input: UserUpdateInput,
  photo: string | null,
  stamp: SQL,
  passwordHash: string,
  roles: SQL
) {
  // The same statement also upserts the credential, so a legacy-imported
  // user (a business row with no Better Auth identity) becomes able to
  // sign in, and a refused write aborts every part of the change together.
  return db.execute(sql`
    with business_user as (
      update master.users
         set name = ${input.name},
             status = ${input.status},
             phone = ${input.phone},
             email = ${input.email},
             profile_photo_path = ${photo},
             updated_at = ${nextStamp(users.updatedAt)}
       where id = ${id} and deleted_at is null and ${stamp}
      returning id, name, email, profile_photo_path
    ), auth_update as (
      update public."user"
         set name = ${input.name},
             email = ${input.email},
             image = ${photo},
             updated_at = now()
       where id = (select id::text from business_user)
      returning id
    ), auth_insert as (
      insert into public."user" (id, name, email, email_verified, image, created_at, updated_at)
      select b.id::text, b.name, b.email, false, b.profile_photo_path, now(), now()
        from business_user b
       where not exists (select 1 from auth_update)
      returning id
    ), credential_update as (
      update public.account
         set password = ${passwordHash}, updated_at = now()
       where account_id = (select id::text from business_user)
         and provider_id = 'credential'
      returning id
    ), credential_insert as (
      insert into public.account
        (id, account_id, provider_id, user_id, password, created_at, updated_at)
      select ${crypto.randomUUID()}, b.id::text, 'credential', b.id::text,
             ${passwordHash}, now(), now()
        from business_user b
       where not exists (select 1 from credential_update)
      returning id
    )${roles}
    select id from business_user
  `);
}

/**
 * Trash a user. `assertCanManageUser` answers first with its own message; the
 * reach test in the delete's `where` closes the window after it, so a user
 * whose reach grew since is not written and answers 403 (ADR-0055). A delete
 * that matches no row reads once to say why: 404, then 403, then 409.
 */
export async function deleteUser(db: MasterDb, id: string, actor: Actor): Promise<void> {
  await assertCanManageUser(db, actor, id);

  const rows = await db
    .update(users)
    // a stamp an editor still holds is never reissued, so its save is stale (as after a save)
    .set({ deletedAt: new Date(), updatedAt: nextStamp(users.updatedAt) })
    .where(
      and(
        eq(users.id, id),
        isNull(users.deletedAt),
        // the check above reads and this is decided in the write: a role granted
        // to the user since is out of the caller's reach and nothing is written
        withinReach(actor, id)
      )
    )
    .returning({ id: users.id });

  if (!rows[0]) {
    throw await whyNotWritten(
      db,
      actor,
      id,
      () => new StaleRecordError("This user changed while it was being deleted. Try again.")
    );
  }

  // The sign-in gate reads this row (#7): soft-deleting it blocks future
  // sessions, and ending the current ones here closes the window for cookies
  // already issued. Deleting the session rows directly is equivalent to Better
  // Auth's `deleteUserSessions` while no cookie cache is configured (ADR-0034).
  await db.delete(authSession).where(eq(authSession.userId, id));
}

export async function restoreUser(db: MasterDb, id: string, actor: Actor): Promise<User> {
  await assertCanManageUser(db, actor, id);

  const rows = await db
    .update(users)
    .set({ deletedAt: null, updatedAt: nextStamp(users.updatedAt) })
    .where(and(eq(users.id, id), isNotNull(users.deletedAt)))
    .returning({ id: users.id });

  if (!rows[0]) throw new NotFoundError("Deleted user not found.");
  return getUser(db, id);
}
