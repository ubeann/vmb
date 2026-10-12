import {
  allPermissionKeys,
  type User,
  type UserCreateInput,
  type UserUpdateInput
} from "@vmb/types";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ID_GROUPS, fixtureId } from "../src/seed/ids.js";
import { seed } from "../src/seed/run.js";
import { ConflictError, ForbiddenError, StaleRecordError } from "../src/errors.js";
import {
  createMasterStore,
  type Actor,
  type MasterDb,
  type OpenTransaction
} from "../src/master/index.js";
import { count, rejects, withMigratedDatabase, transactionsOn, withMigratedDb } from "./harness.js";

const SUPER_ADMIN = fixtureId(ID_GROUPS.role, 1);
const MANAGER_FINANCE = fixtureId(ID_GROUPS.role, 2);
const FINANCE = fixtureId(ID_GROUPS.division, 2);

describe("role-based access tables", () => {
  it("lets Super Admin hold every permission the catalogue defines", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);

      expect(await count(client, "select count(*)::int as value from master.permissions")).toBe(
        allPermissionKeys().length
      );
      // by ordinary grants, not a bypass: a catalogue key with no grant fails here
      expect(
        await count(
          client,
          `select count(*)::int as value from master.permissions p
            where not exists (
              select 1 from master.role_permissions g
               where g.role_id = '${SUPER_ADMIN}' and g.permission_key = p.key)`
        )
      ).toBe(0);
    });
  });

  it("refuses a permission whose key is not its resource and action", async () => {
    await withMigratedDatabase(async (client) => {
      await rejects(
        client,
        `insert into master.permissions (key, resource, action)
           values ('master-users.view', 'master-users', 'delete')`,
        /permissions_key_check/
      );
    });
  });

  it("refuses to delete a role that users still hold", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);

      await rejects(
        client,
        `delete from master.roles where id = '${SUPER_ADMIN}'`,
        /master_user_roles_role_id_foreign/
      );
    });
  });

  it("takes a role's grants with it when the role is deleted unused", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);
      await client.exec(`delete from master.user_roles where role_id = '${MANAGER_FINANCE}'`);

      await client.exec(`delete from master.roles where id = '${MANAGER_FINANCE}'`);

      expect(
        await count(
          client,
          `select count(*)::int as value from master.role_permissions
            where role_id = '${MANAGER_FINANCE}'`
        )
      ).toBe(0);
    });
  });

  it("takes a user's assignments with the user", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);
      // the seeded users are referenced by domain rows, so use a fresh one
      const user = fixtureId(ID_GROUPS.user, 99);
      await client.exec(
        `insert into master.users (id, name, email) values ('${user}', 'Temp', 'temp@example.test');
         insert into master.user_roles (user_id, role_id) values ('${user}', '${SUPER_ADMIN}')`
      );

      await client.exec(`delete from master.users where id = '${user}'`);

      expect(
        await count(
          client,
          `select count(*)::int as value from master.user_roles where user_id = '${user}'`
        )
      ).toBe(0);
    });
  });

  it("refuses to hard-delete a division that a role operates in", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);

      await rejects(
        client,
        `delete from master.divisions where id = '${FINANCE}'`,
        /master_roles_division_id_foreign/
      );
    });
  });
});

/** The caller as a request sees them: their id and the permissions it read once. */
async function actor(db: MasterDb, id: string): Promise<Actor> {
  const store = createMasterStore(db, {
    hashPassword: async (password) => password,
    transaction: transactionsOn(db)
  });
  return { id, permissions: await store.getPermissions(id) };
}

describe("a user's permissions", () => {
  const store = (db: MasterDb) =>
    createMasterStore(db, {
      hashPassword: async (password) => password,
      transaction: transactionsOn(db)
    });
  const ADMIN = fixtureId(ID_GROUPS.user, 1); // Super Admin
  const MANAGER = fixtureId(ID_GROUPS.user, 2); // Manager Finance, their only role

  it("are their active roles' grants, sorted and once each, read in one statement", async () => {
    await withMigratedDb(async (db, client, statements) => {
      await seed(client);
      statements.length = 0;

      const permissions = await store(db).getPermissions(ADMIN);

      expect(statements).toHaveLength(1);
      expect(permissions).toEqual([...allPermissionKeys()].sort());
    });
  });

  it.each(["suspended", "inactive"])("are none for a %s user", async (status) => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      expect((await store(db).getPermissions(ADMIN)).length).toBeGreaterThan(0);

      await client.exec(`update master.users set status = '${status}' where id = '${ADMIN}'`);

      expect(await store(db).getPermissions(ADMIN)).toEqual([]);
    });
  });

  it("are none for a Trashed user", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      await client.exec(`update master.users set deleted_at = now() where id = '${ADMIN}'`);

      expect(await store(db).getPermissions(ADMIN)).toEqual([]);
    });
  });

  it("are none when the user's only role is inactive", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      expect((await store(db).getPermissions(MANAGER)).length).toBeGreaterThan(0);

      await client.exec(
        `update master.roles set is_active = false where id = '${MANAGER_FINANCE}'`
      );

      expect(await store(db).getPermissions(MANAGER)).toEqual([]);
    });
  });

  it("are none for a user with no roles, and for one that does not exist", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      expect(await store(db).getPermissions(fixtureId(ID_GROUPS.user, 9))).toEqual([]);
      expect(await store(db).getPermissions(fixtureId(ID_GROUPS.user, 99))).toEqual([]);
    });
  });

  it("lose a grant as soon as it is removed: nothing is kept between reads", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const shared = store(db);
      expect(await shared.getPermissions(MANAGER)).toContain("master-divisions.view");

      await client.exec(
        `delete from master.role_permissions
          where role_id = '${MANAGER_FINANCE}' and permission_key = 'master-divisions.view'`
      );

      expect(await shared.getPermissions(MANAGER)).not.toContain("master-divisions.view");
    });
  });
});

describe("a user's access", () => {
  const store = (db: Parameters<typeof createMasterStore>[0]) =>
    createMasterStore(db, {
      hashPassword: async (password) => password,
      transaction: transactionsOn(db)
    });

  it("is the union of their active roles' permissions, sorted", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const user = fixtureId(ID_GROUPS.user, 3);
      await client.exec(
        `insert into master.user_roles (user_id, role_id) values ('${user}', '${MANAGER_FINANCE}')`
      );

      const access = await store(db).getAccess(user);

      // the user already held Manager Division (seeded) and now Manager Finance too
      expect(access.permissions).toEqual([...access.permissions].sort());
      expect(access.permissions).toContain("master-divisions.manager");
      expect(new Set(access.permissions).size).toBe(access.permissions.length);
      expect(access.permissions).not.toContain("master-users.delete");
    });
  });

  it("gets nothing from an inactive role", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const user = fixtureId(ID_GROUPS.user, 2);
      expect((await store(db).getAccess(user)).permissions.length).toBeGreaterThan(0);

      await client.exec(
        `update master.roles set is_active = false where id = '${MANAGER_FINANCE}'`
      );

      expect((await store(db).getAccess(user)).permissions).toEqual([]);
    });
  });

  it("is empty for a user with no roles, and for one that does not exist", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      const unassigned = await store(db).getAccess(fixtureId(ID_GROUPS.user, 9));
      const missing = await store(db).getAccess(fixtureId(ID_GROUPS.user, 99));

      expect(unassigned.permissions).toEqual([]);
      expect(missing).toEqual({ permissions: [], divisions: [] });
    });
  });

  it("names the division the user belongs to, unless it is Trashed", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const user = fixtureId(ID_GROUPS.user, 2);

      const before = await store(db).getAccess(user);
      expect(before.divisions).toEqual([
        { id: FINANCE, name: "Finance", iconName: expect.any(String) }
      ]);

      await client.exec(`update master.divisions set deleted_at = now() where id = '${FINANCE}'`);

      expect((await store(db).getAccess(user)).divisions).toEqual([]);
    });
  });
});

/**
 * The statement another connection to this database is blocked on, waiting
 * for a lock; polled until one appears, for at most ten seconds.
 */
async function waitingQuery(observer: MasterDb): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { rows } = (await observer.execute(sql`
      select query from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock'
    `)) as unknown as { rows: Array<{ query: string }> };
    if (rows[0]) return rows[0].query;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("no connection started waiting for a lock");
}

describe("assigning roles to users", () => {
  const store = (db: Parameters<typeof createMasterStore>[0]) =>
    createMasterStore(db, {
      hashPassword: async (password) => `hashed:${password}`,
      transaction: transactionsOn(db)
    });

  const SUPER_ADMIN_USER = fixtureId(ID_GROUPS.user, 1);
  const MANAGER_USER = fixtureId(ID_GROUPS.user, 2); // holds Manager Finance
  const STAFF_ROLE = fixtureId(ID_GROUPS.role, 4); // divisions.view only, a subset of the manager's

  const newUser = (overrides: Partial<UserCreateInput> = {}): UserCreateInput => ({
    name: "Dani Pratama",
    email: "dani@vmblogistics.id",
    phone: "+628111000077",
    status: "active",
    roleIds: [],
    profilePhotoPath: "",
    password: "password123",
    passwordConfirmation: "password123",
    ...overrides
  });

  const edit = (user: User, roleIds: string[]): UserUpdateInput => ({
    name: user.name,
    email: user.email,
    phone: user.phone ?? "+628111000077",
    status: user.status,
    roleIds,
    profilePhotoPath: "",
    password: "",
    passwordConfirmation: "",
    updatedAt: user.updatedAt
  });

  it("creates a user holding the chosen roles, named in the result", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      const created = await store(db).createUser(
        newUser({ roleIds: [STAFF_ROLE, MANAGER_FINANCE] }),
        await actor(db, SUPER_ADMIN_USER)
      );

      expect(created.roles.map((role) => role.name)).toEqual(["Manager Finance", "Staff"]);
    });
  });

  it("replaces the set on update: adds the new, removes the dropped, keeps the rest", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const created = await store(db).createUser(
        newUser({ roleIds: [STAFF_ROLE] }),
        await actor(db, SUPER_ADMIN_USER)
      );

      const updated = await store(db).updateUser(
        created.id,
        edit(created, [MANAGER_FINANCE]),
        await actor(db, SUPER_ADMIN_USER)
      );
      expect(updated.roles.map((role) => role.name)).toEqual(["Manager Finance"]);

      // saving the same set again is harmless, and an empty set clears the roles
      await store(db).updateUser(
        created.id,
        edit(updated, [MANAGER_FINANCE]),
        await actor(db, SUPER_ADMIN_USER)
      );
      const cleared = await store(db).updateUser(
        created.id,
        edit(await store(db).getUser(created.id), []),
        await actor(db, SUPER_ADMIN_USER)
      );
      expect(cleared.roles).toEqual([]);
    });
  });

  it("lets a caller grant only roles whose permissions they hold themselves", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const target = await store(db).createUser(newUser(), await actor(db, SUPER_ADMIN_USER));

      // the Finance manager holds master-divisions.view*, so may grant Staff
      await expect(
        store(db).updateUser(target.id, edit(target, [STAFF_ROLE]), await actor(db, MANAGER_USER))
      ).resolves.toMatchObject({ roles: [{ name: "Staff" }] });

      // but Super Admin carries keys the manager lacks
      await expect(
        store(db).updateUser(target.id, edit(target, [SUPER_ADMIN]), await actor(db, MANAGER_USER))
      ).rejects.toMatchObject({ code: "PERMISSION_ESCALATION" });
      await expect(
        store(db).createUser(
          newUser({ email: "x@vmblogistics.id", roleIds: [SUPER_ADMIN] }),
          await actor(db, MANAGER_USER)
        )
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  it("will not let a caller take away a role that carries permissions they lack", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const admin = await store(db).getUser(SUPER_ADMIN_USER);

      await expect(
        store(db).updateUser(admin.id, edit(admin, []), await actor(db, MANAGER_USER))
      ).rejects.toBeInstanceOf(ForbiddenError);
      // nothing changed
      expect((await store(db).getUser(admin.id)).roles.map((role) => role.name)).toEqual([
        "Super Admin"
      ]);
    });
  });

  it("rolls a role change back whole when the save fails after the check (ADR-0049)", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const admin = await actor(db, SUPER_ADMIN_USER);
      const target = await store(db).createUser(newUser({ roleIds: [STAFF_ROLE] }), admin);
      const other = await store(db).createUser(
        newUser({ email: "taken@vmblogistics.id", phone: "+628111000078" }),
        admin
      );

      // the role writes go through, then the user's own write is refused
      await expect(
        store(db).updateUser(
          target.id,
          { ...edit(target, [MANAGER_FINANCE]), email: other.email },
          admin
        )
      ).rejects.toBeInstanceOf(ConflictError);

      expect((await store(db).getUser(target.id)).roles.map((role) => role.name)).toEqual([
        "Staff"
      ]);
    });
  });

  it("rolls back a role change whose save is stale (#378)", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const admin = await actor(db, SUPER_ADMIN_USER);
      const target = await store(db).createUser(newUser({ roleIds: [STAFF_ROLE] }), admin);
      // someone else saves the user after this editor loaded it
      await store(db).updateUser(
        target.id,
        { ...edit(target, [STAFF_ROLE]), name: "Dani P." },
        admin
      );

      await expect(
        store(db).updateUser(target.id, edit(target, [MANAGER_FINANCE]), admin)
      ).rejects.toBeInstanceOf(StaleRecordError);

      expect((await store(db).getUser(target.id)).roles.map((role) => role.name)).toEqual([
        "Staff"
      ]);
    });
  });

  it("opens a transaction only for a save that changes roles, after hashing the password", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const steps: string[] = [];
      const counted = createMasterStore(db, {
        hashPassword: async (password) => {
          steps.push("hash");
          return password;
        },
        transaction: (work) => {
          steps.push("transaction");
          return transactionsOn(db)(work);
        }
      });
      const admin = await actor(db, SUPER_ADMIN_USER);
      const target = await store(db).createUser(newUser({ roleIds: [STAFF_ROLE] }), admin);

      await counted.listUsers({
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      await counted.getUser(target.id);
      // the form sends the roles the user already holds, or none at all
      const kept = await counted.updateUser(target.id, edit(target, [STAFF_ROLE]), admin);
      const omitted = await counted.updateUser(
        target.id,
        { ...edit(kept, []), roleIds: undefined },
        admin
      );
      expect(steps).toEqual([]);

      await counted.updateUser(
        target.id,
        { ...edit(omitted, [MANAGER_FINANCE]), password: "a-new-password" },
        admin
      );
      expect(steps).toEqual(["hash", "transaction"]);
    });
  });

  // Two role changes on one user, each in a request of its own. PGlite is a
  // single connection, so this runs on real Postgres only, as CI's Real Postgres
  // job does (`TEST_DATABASE_URL`).
  it.skipIf(!process.env.TEST_DATABASE_URL)(
    "makes a concurrent role change on the same user wait, then check what the first wrote",
    async () => {
      await withMigratedDb(async (db, client, _statements, connect) => {
        await seed(client);
        const admin = await actor(db, SUPER_ADMIN_USER);
        const target = await store(db).createUser(newUser({ roleIds: [STAFF_ROLE] }), admin);

        // Super Admin's request, on a connection of its own, holds its
        // transaction open once its work is done, until the test lets it commit
        const adminDb = await connect!();
        let worked!: () => void;
        let commit!: () => void;
        const adminWorked = new Promise<void>((resolve) => (worked = resolve));
        const committable = new Promise<void>((resolve) => (commit = resolve));
        const holding: OpenTransaction = (work) =>
          adminDb.transaction(async (tx) => {
            const result = await work(tx);
            worked();
            await committable;
            return result;
          });
        const adminSave = createMasterStore(adminDb, {
          hashPassword: async (password) => password,
          transaction: holding
        }).updateUser(target.id, edit(target, [STAFF_ROLE, SUPER_ADMIN]), admin);

        try {
          await adminWorked;

          // The Finance manager may manage the target as it was (Staff only),
          // and without the lock their check would pass against that.
          const managerSave = store(db).updateUser(
            target.id,
            edit(target, [STAFF_ROLE, MANAGER_FINANCE]),
            await actor(db, MANAGER_USER)
          );
          managerSave.catch(() => undefined);

          // ...so it must be waiting on the row lock, before any check, while
          // the first change is still open
          expect(await waitingQuery(await connect!())).toMatch(/for update/i);

          commit();
          await adminSave;
          // it now sees the Super Admin role the first change granted
          await expect(managerSave).rejects.toMatchObject({ code: "PERMISSION_ESCALATION" });
        } finally {
          commit();
        }
        expect((await store(db).getUser(target.id)).roles.map((role) => role.name)).toEqual([
          "Staff",
          "Super Admin"
        ]);
      });
    }
  );

  it("lets Super Admin grant Super Admin", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      const created = await store(db).createUser(
        newUser({ roleIds: [SUPER_ADMIN] }),
        await actor(db, SUPER_ADMIN_USER)
      );

      expect(created.roles.map((role) => role.name)).toEqual(["Super Admin"]);
    });
  });

  it("reports a role that does not exist", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      await expect(
        store(db).createUser(
          newUser({ roleIds: ["00000000-0000-4000-8000-0000000000ee"] }),
          await actor(db, SUPER_ADMIN_USER)
        )
      ).rejects.toThrow("One of the chosen roles no longer exists.");
    });
  });

  it("filters the user list by the division a role is scoped to", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      const list = await store(db).listUsers({
        divisionId: FINANCE,
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });

      expect(list.items.map((user) => user.id)).toEqual([MANAGER_USER]);
    });
  });
});

describe("deleting a role", () => {
  it("is refused with a count while users hold it, and allowed once they do not", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const store = createMasterStore(db, {
        hashPassword: async (password) => password,
        transaction: transactionsOn(db)
      });
      const staff = fixtureId(ID_GROUPS.role, 4);
      await client.exec(
        `insert into master.user_roles (user_id, role_id) values ('${fixtureId(ID_GROUPS.user, 5)}', '${staff}'),
                                                                  ('${fixtureId(ID_GROUPS.user, 6)}', '${staff}')`
      );

      await expect(store.deleteRole(staff)).rejects.toMatchObject({
        code: "ROLE_IN_USE",
        message: "3 users hold this role. Remove it from them first."
      });

      await client.exec(`delete from master.user_roles where role_id = '${staff}'`);
      await expect(store.deleteRole(staff)).resolves.toBeUndefined();
    });
  });
});

describe("the permission catalogue", () => {
  it("is exactly what the migrations load, so a change to either needs the other", async () => {
    await withMigratedDatabase(async (client) => {
      const rows = await client.query<{ key: string }>(
        "select key from master.permissions order by key"
      );

      expect(rows.map((row) => row.key)).toEqual([...allPermissionKeys()].sort());
    });
  });
});

describe("reaching a more privileged user", () => {
  const store = (db: Parameters<typeof createMasterStore>[0]) =>
    createMasterStore(db, {
      hashPassword: async (password) => `hashed:${password}`,
      transaction: transactionsOn(db)
    });

  const ADMIN = fixtureId(ID_GROUPS.user, 1); // Super Admin
  const MANAGER = fixtureId(ID_GROUPS.user, 2); // Manager Finance
  const STAFF_USER = fixtureId(ID_GROUPS.user, 4); // Staff, a subset of the manager's permissions

  const resetPassword = (user: User): UserUpdateInput => ({
    name: user.name,
    email: user.email,
    phone: user.phone ?? "+628111000077",
    status: user.status,
    profilePhotoPath: "",
    password: "a-brand-new-password",
    passwordConfirmation: "a-brand-new-password",
    updatedAt: user.updatedAt
  });

  it("refuses to edit, delete or restore a user who holds permissions the caller lacks", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const admin = await store(db).getUser(ADMIN);

      // roleIds omitted: only the credential changes, yet it is still account takeover
      await expect(
        store(db).updateUser(ADMIN, resetPassword(admin), await actor(db, MANAGER))
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(store(db).deleteUser(ADMIN, await actor(db, MANAGER))).rejects.toMatchObject({
        code: "PERMISSION_ESCALATION"
      });
      await expect(
        store(db).updateUser(
          ADMIN,
          { ...resetPassword(admin), status: "suspended" },
          await actor(db, MANAGER)
        )
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(
        await count(
          client,
          `select count(*)::int as value from public.account
            where account_id = '${ADMIN}' and password = 'hashed:a-brand-new-password'`
        )
      ).toBe(0);

      await client.exec(`update master.users set deleted_at = now() where id = '${ADMIN}'`);
      await expect(store(db).restoreUser(ADMIN, await actor(db, MANAGER))).rejects.toBeInstanceOf(
        ForbiddenError
      );
    });
  });

  it("lets a caller manage someone whose permissions they hold, and themselves", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const staff = await store(db).getUser(STAFF_USER);
      const manager = await store(db).getUser(MANAGER);

      await expect(
        store(db).updateUser(STAFF_USER, resetPassword(staff), await actor(db, MANAGER))
      ).resolves.toMatchObject({
        id: STAFF_USER
      });
      await expect(
        store(db).updateUser(MANAGER, resetPassword(manager), await actor(db, MANAGER))
      ).resolves.toMatchObject({
        id: MANAGER
      });
      // a Super Admin may manage anyone
      await expect(
        store(db).updateUser(
          MANAGER,
          resetPassword(await store(db).getUser(MANAGER)),
          await actor(db, ADMIN)
        )
      ).resolves.toMatchObject({
        id: MANAGER
      });
    });
  });

  // A role granted to the target after the caller's check and before the write
  // (ADR-0055's reach test). PGlite is a single connection, so these run on real
  // Postgres only, as CI's Real Postgres job does. A second connection holds a
  // share lock on `master.users`, which stops the write at the door of its
  // statement, before it takes its snapshot; the check ahead of it has already
  // passed. That connection grants Super Admin to the Staff user and commits,
  // and the write then runs against what the grant made.
  const grantWhileWriting = async (
    connect: () => Promise<MasterDb>,
    write: () => Promise<unknown>
  ) => {
    const other = await connect();
    await other.execute(sql`begin`);
    await other.execute(sql`lock table master.users in share mode`);
    const written = write();
    written.catch(() => undefined);
    try {
      expect(await waitingQuery(await connect())).toMatch(/update\s+"?master"?\."?users/i);
      await other.execute(
        sql`insert into master.user_roles (user_id, role_id) values (${STAFF_USER}, ${SUPER_ADMIN})`
      );
    } finally {
      await other.execute(sql`commit`);
    }
    return written;
  };

  it.skipIf(!process.env.TEST_DATABASE_URL)(
    "refuses a delete of a user who gains a role the caller lacks after the check, and changes nothing",
    async () => {
      await withMigratedDb(async (db, client, _statements, connect) => {
        await seed(client);
        const manager = await actor(db, MANAGER);

        await expect(
          grantWhileWriting(connect!, () => store(db).deleteUser(STAFF_USER, manager))
        ).rejects.toMatchObject({ code: "PERMISSION_ESCALATION" });

        expect(
          await count(
            client,
            `select count(*)::int as value from master.users
              where id = '${STAFF_USER}' and deleted_at is null`
          )
        ).toBe(1);
      });
    }
  );

  it.skipIf(!process.env.TEST_DATABASE_URL)(
    "refuses an edit that keeps the roles of a user who gains a role the caller lacks after the check",
    async () => {
      await withMigratedDb(async (db, client, _statements, connect) => {
        await seed(client);
        const manager = await actor(db, MANAGER);
        const staff = await store(db).getUser(STAFF_USER);

        await expect(
          grantWhileWriting(connect!, () =>
            store(db).updateUser(STAFF_USER, resetPassword(staff), manager)
          )
        ).rejects.toMatchObject({ code: "PERMISSION_ESCALATION" });

        expect((await store(db).getUser(STAFF_USER)).updatedAt).toBe(staff.updatedAt);
        expect(
          await count(
            client,
            `select count(*)::int as value from public.account
              where account_id = '${STAFF_USER}' and password = 'hashed:a-brand-new-password'`
          )
        ).toBe(0);
      });
    }
  );

  it("lets a caller delete themselves, and a Trashed user is not found", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      await store(db).deleteUser(MANAGER, await actor(db, MANAGER));
      await expect(store(db).deleteUser(MANAGER, await actor(db, ADMIN))).rejects.toMatchObject({
        code: "NOT_FOUND"
      });
      await expect(store(db).deleteUser(MANAGER, await actor(db, MANAGER))).rejects.toMatchObject({
        code: "NOT_FOUND"
      });
    });
  });

  it("leaves a user's roles alone when the update names none", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const manager = await store(db).getUser(MANAGER);
      const before = manager.roles.map((role) => role.name);
      expect(before.length).toBeGreaterThan(0);

      const updated = await store(db).updateUser(
        MANAGER,
        resetPassword(manager),
        await actor(db, ADMIN)
      );

      expect(updated.roles.map((role) => role.name)).toEqual(before);
    });
  });

  it("reads uppercase role ids as the same role", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const target = await store(db).getUser(STAFF_USER);

      const updated = await store(db).updateUser(
        STAFF_USER,
        { ...resetPassword(target), roleIds: [fixtureId(ID_GROUPS.role, 4).toUpperCase()] },
        await actor(db, ADMIN)
      );

      expect(updated.roles).toHaveLength(1);
    });
  });
});

describe("what a request costs (ADR-0045's amendment)", () => {
  const ADMIN = fixtureId(ID_GROUPS.user, 1);
  const STAFF_USER = fixtureId(ID_GROUPS.user, 4);
  // the read `getPermissions` sends: the only statement that joins the caller's
  // own user row to the grants
  const PERMISSION_READ = /from "master"\."users" inner join "master"\."user_roles"/;

  // A role-changing PATCH /api/master/users/:id: `requirePermission` reads the
  // caller's permissions, then the store checks and writes. 17 statements before
  // the amendment, three of those reads of the caller's access at three apiece;
  // 9 after it. ADR-0049 adds one net: a read of the current roles, so a save
  // that keeps them opens no transaction, and the lock on the target's row,
  // which the existence check folds into; the role writes stay CTEs of the
  // user's own statement (ADR-0055), so the lock is what the transaction adds.
  it("changes a user's roles in 10 statements, reading the caller's permissions once", async () => {
    await withMigratedDb(async (db, client, statements) => {
      await seed(client);
      const store = createMasterStore(db, {
        hashPassword: async (password) => password,
        transaction: transactionsOn(db)
      });
      const target = await store.getUser(STAFF_USER);
      statements.length = 0;

      const caller = await actor(db, ADMIN);
      const updated = await store.updateUser(
        STAFF_USER,
        {
          name: target.name,
          email: target.email,
          phone: target.phone ?? "+628111000077",
          status: target.status,
          roleIds: [MANAGER_FINANCE],
          profilePhotoPath: "",
          password: "",
          passwordConfirmation: "",
          updatedAt: target.updatedAt
        },
        caller
      );

      expect(updated.roles.map((role) => role.name)).toEqual(["Manager Finance"]);
      expect(statements.filter((statement) => PERMISSION_READ.test(statement))).toHaveLength(1);
      // `begin` and `commit` are logged by node-postgres but not by PGlite
      const work = statements.filter((statement) => !/^\s*(begin|commit)\b/i.test(statement));
      expect(work).toHaveLength(10);
    });
  });

  // The reach test rides inside the write's own statement (ADR-0055), so a
  // delete, and a save that keeps the roles, cost what they did before it: the
  // check's two reads, the write, and the sessions it ends. Only a write that
  // matches no row adds a read, to word its refusal.
  it("deletes a user in 4 statements, and a refused delete adds one read to say why", async () => {
    await withMigratedDb(async (db, client, statements) => {
      await seed(client);
      const store = createMasterStore(db, {
        hashPassword: async (password) => password,
        transaction: transactionsOn(db)
      });
      const caller = await actor(db, ADMIN);
      statements.length = 0;

      await store.deleteUser(STAFF_USER, caller);
      expect(statements).toHaveLength(4);

      statements.length = 0;
      await expect(store.deleteUser(STAFF_USER, caller)).rejects.toMatchObject({
        code: "NOT_FOUND"
      });
      // the check's two reads, the delete that matches nothing, the read that words the 404
      expect(statements).toHaveLength(4);
    });
  });

  it("saves a user who keeps their roles in 6 statements, none of them a transaction", async () => {
    await withMigratedDb(async (db, client, statements) => {
      await seed(client);
      const store = createMasterStore(db, {
        hashPassword: async (password) => password,
        transaction: transactionsOn(db)
      });
      const target = await store.getUser(STAFF_USER);
      const caller = await actor(db, ADMIN);
      statements.length = 0;

      await store.updateUser(
        STAFF_USER,
        {
          name: target.name,
          email: target.email,
          phone: target.phone ?? "+628111000077",
          status: target.status,
          roleIds: target.roles.map((role) => role.id),
          profilePhotoPath: "",
          password: "",
          passwordConfirmation: "",
          updatedAt: target.updatedAt
        },
        caller
      );

      // the roles read, the existence read, the check's two reads, the write, the result
      expect(statements).toHaveLength(6);
    });
  });
});

describe("a session that outlives its user", () => {
  it("grants nothing once the user is suspended or Trashed", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const store = createMasterStore(db, {
        hashPassword: async (password) => password,
        transaction: transactionsOn(db)
      });
      const admin = fixtureId(ID_GROUPS.user, 1);
      expect((await store.getAccess(admin)).permissions.length).toBeGreaterThan(0);

      await client.exec(`update master.users set status = 'suspended' where id = '${admin}'`);
      expect(await store.getAccess(admin)).toEqual({ permissions: [], divisions: [] });

      await client.exec(
        `update master.users set status = 'active', deleted_at = now() where id = '${admin}'`
      );
      expect(await store.getAccess(admin)).toEqual({ permissions: [], divisions: [] });
    });
  });
});
