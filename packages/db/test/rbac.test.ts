import {
  allPermissionKeys,
  type User,
  type UserCreateInput,
  type UserUpdateInput
} from "@vmb/types";
import { describe, expect, it } from "vitest";
import { ID_GROUPS, fixtureId } from "../src/seed/ids.js";
import { seed } from "../src/seed/run.js";
import { createMasterStore, MasterForbiddenError } from "../src/master/index.js";
import { count, rejects, withMigratedDatabase, withMigratedDb } from "./harness.js";

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

describe("a user's access", () => {
  const store = (db: Parameters<typeof createMasterStore>[0]) =>
    createMasterStore(db, { hashPassword: async (password) => password });

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

describe("assigning roles to users", () => {
  const store = (db: Parameters<typeof createMasterStore>[0]) =>
    createMasterStore(db, { hashPassword: async (password) => `hashed:${password}` });

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
    passwordConfirmation: ""
  });

  it("creates a user holding the chosen roles, named in the result", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      const created = await store(db).createUser(
        newUser({ roleIds: [STAFF_ROLE, MANAGER_FINANCE] }),
        SUPER_ADMIN_USER
      );

      expect(created.roles.map((role) => role.name)).toEqual(["Manager Finance", "Staff"]);
    });
  });

  it("replaces the set on update: adds the new, removes the dropped, keeps the rest", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const created = await store(db).createUser(
        newUser({ roleIds: [STAFF_ROLE] }),
        SUPER_ADMIN_USER
      );

      const updated = await store(db).updateUser(
        created.id,
        edit(created, [MANAGER_FINANCE]),
        SUPER_ADMIN_USER
      );
      expect(updated.roles.map((role) => role.name)).toEqual(["Manager Finance"]);

      // saving the same set again is harmless, and an empty set clears the roles
      await store(db).updateUser(created.id, edit(created, [MANAGER_FINANCE]), SUPER_ADMIN_USER);
      const cleared = await store(db).updateUser(created.id, edit(created, []), SUPER_ADMIN_USER);
      expect(cleared.roles).toEqual([]);
    });
  });

  it("lets a caller grant only roles whose permissions they hold themselves", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const target = await store(db).createUser(newUser(), SUPER_ADMIN_USER);

      // the Finance manager holds master-divisions.view*, so may grant Staff
      await expect(
        store(db).updateUser(target.id, edit(target, [STAFF_ROLE]), MANAGER_USER)
      ).resolves.toMatchObject({ roles: [{ name: "Staff" }] });

      // but Super Admin carries keys the manager lacks
      await expect(
        store(db).updateUser(target.id, edit(target, [SUPER_ADMIN]), MANAGER_USER)
      ).rejects.toBeInstanceOf(MasterForbiddenError);
      await expect(
        store(db).createUser(
          newUser({ email: "x@vmblogistics.id", roleIds: [SUPER_ADMIN] }),
          MANAGER_USER
        )
      ).rejects.toBeInstanceOf(MasterForbiddenError);
    });
  });

  it("will not let a caller take away a role that carries permissions they lack", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);
      const admin = await store(db).getUser(SUPER_ADMIN_USER);

      await expect(
        store(db).updateUser(admin.id, edit(admin, []), MANAGER_USER)
      ).rejects.toBeInstanceOf(MasterForbiddenError);
      // nothing changed
      expect((await store(db).getUser(admin.id)).roles.map((role) => role.name)).toEqual([
        "Super Admin"
      ]);
    });
  });

  it("lets Super Admin grant Super Admin", async () => {
    await withMigratedDb(async (db, client) => {
      await seed(client);

      const created = await store(db).createUser(
        newUser({ roleIds: [SUPER_ADMIN] }),
        SUPER_ADMIN_USER
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
          SUPER_ADMIN_USER
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
      const store = createMasterStore(db, { hashPassword: async (password) => password });
      const staff = fixtureId(ID_GROUPS.role, 4);
      await client.exec(
        `insert into master.user_roles (user_id, role_id) values ('${fixtureId(ID_GROUPS.user, 5)}', '${staff}'),
                                                                  ('${fixtureId(ID_GROUPS.user, 6)}', '${staff}')`
      );

      await expect(store.deleteRole(staff)).rejects.toThrow(
        "3 users hold this role. Remove it from them first."
      );

      await client.exec(`delete from master.user_roles where role_id = '${staff}'`);
      await expect(store.deleteRole(staff)).resolves.toBeUndefined();
    });
  });
});
