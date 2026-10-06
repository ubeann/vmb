import { allPermissionKeys } from "@vmb/types";
import { describe, expect, it } from "vitest";
import { ID_GROUPS, fixtureId } from "../src/seed/ids.js";
import { seed } from "../src/seed/run.js";
import { createMasterStore } from "../src/master/index.js";
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
