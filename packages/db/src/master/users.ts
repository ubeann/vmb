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
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL
} from "drizzle-orm";
import { session as authSession } from "../schema/auth.js";
import { users } from "../schema/master.js";
import { conflictFrom, nullIfEmpty, toIso, type MasterDb } from "./db.js";
import { MasterNotFoundError } from "./errors.js";

type UserRow = typeof users.$inferSelect;

export type UserStoreOptions = {
  hashPassword: (password: string) => Promise<string>;
};

const SORT_COLUMNS = {
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
} as const;

const EMAIL_CONFLICT = {
  master_users_email_unique: "A user with that email already exists.",
  user_email_unique: "A user with that email already exists."
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    status: row.status as UserStatus,
    divisionId: row.divisionId,
    phone: row.phone,
    email: row.email,
    emailVerifiedAt: toIso(row.emailVerifiedAt),
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
  if (query.divisionId) conditions.push(eq(users.divisionId, query.divisionId));
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
    db
      .select()
      .from(users)
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
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new MasterNotFoundError("User not found.");
  return toUser(row);
}

/**
 * The sign-in gate's lookup (#7, ADR-0033): whether a session may exist at all
 * for this user. Missing rows and DB failures are the caller's to interpret;
 * this returns `null` only for a user that is not there.
 */
export async function getUserStatus(
  db: MasterDb,
  id: string
): Promise<{ deletedAt: string | null } | null> {
  const rows = await db
    .select({ deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { deletedAt: toIso(row.deletedAt) };
}

export async function createUser(
  db: MasterDb,
  options: UserStoreOptions,
  input: UserCreateInput
): Promise<User> {
  const id = crypto.randomUUID();
  const passwordHash = await options.hashPassword(input.password);

  try {
    // One statement, so either the business row, the Better Auth identity and
    // its credential all land, or none does: the Neon HTTP driver has no
    // interactive transactions, but a single CTE is atomic on any Postgres.
    await db.execute(sql`
      with business_user as (
        insert into master.users
          (id, name, status, division_id, phone, email, profile_photo_path, created_at, updated_at)
        values
          (${id}, ${input.name}, ${input.status}, ${input.divisionId}, ${input.phone}, ${input.email},
           ${nullIfEmpty(input.profilePhotoPath)}, now(), now())
        returning id
      ), auth_user as (
        insert into public."user" (id, name, email, email_verified, image, created_at, updated_at)
        select id, ${input.name}, ${input.email}, false, ${nullIfEmpty(input.profilePhotoPath)}, now(), now()
          from business_user
        returning id
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

export async function updateUser(
  db: MasterDb,
  options: UserStoreOptions,
  id: string,
  input: UserUpdateInput
): Promise<User> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing[0]) throw new MasterNotFoundError("User not found.");

  const photo = nullIfEmpty(input.profilePhotoPath);

  try {
    if (input.password === "") {
      // One statement, so an existing Better Auth identity cannot drift from
      // the business row when either side refuses the change (a duplicate
      // email, most likely). An identity that does not exist yet is #7's
      // transform to create.
      await db.execute(sql`
        with business_user as (
          update master.users
             set name = ${input.name},
                 status = ${input.status},
                 division_id = ${input.divisionId},
                 phone = ${input.phone},
                 email = ${input.email},
                 profile_photo_path = ${photo},
                 updated_at = now()
           where id = ${id}
          returning id
        )
        update public."user"
           set name = ${input.name},
               email = ${input.email},
               image = ${photo},
               updated_at = now()
         where id = (select id::text from business_user)
      `);
    } else {
      const passwordHash = await options.hashPassword(input.password);

      // The same statement also upserts the credential, so a legacy-imported
      // user (a business row with no Better Auth identity) becomes able to
      // sign in, and a refused write aborts every part of the change together.
      await db.execute(sql`
        with business_user as (
          update master.users
             set name = ${input.name},
                 status = ${input.status},
                 division_id = ${input.divisionId},
                 phone = ${input.phone},
                 email = ${input.email},
                 profile_photo_path = ${photo},
                 updated_at = now()
           where id = ${id}
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
        )
        insert into public.account
          (id, account_id, provider_id, user_id, password, created_at, updated_at)
        select ${crypto.randomUUID()}, b.id::text, 'credential', b.id::text,
               ${passwordHash}, now(), now()
          from business_user b
         where not exists (select 1 from credential_update)
      `);
    }
  } catch (error) {
    return conflictFrom(error, EMAIL_CONFLICT);
  }

  return getUser(db, id);
}

export async function deleteUser(db: MasterDb, id: string): Promise<void> {
  const rows = await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning({ id: users.id });

  if (!rows[0]) throw new MasterNotFoundError("User not found.");

  // Until the auth gate lands (#7), sign-in is not yet checked against this
  // record, so ending the sessions is what a delete can enforce today; the
  // deleted_at it writes is what the gate will read.
  await db.delete(authSession).where(eq(authSession.userId, id));
}

export async function restoreUser(db: MasterDb, id: string): Promise<User> {
  const rows = await db
    .update(users)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(users.id, id), isNotNull(users.deletedAt)))
    .returning();

  const row = rows[0];
  if (!row) throw new MasterNotFoundError("Deleted user not found.");
  return toUser(row);
}
