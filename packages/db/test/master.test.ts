import type { DivisionInput, RoleInput, UserCreateInput, UserUpdateInput } from "@vmb/types";
import { describe, expect, it } from "vitest";
import {
  createMasterStore,
  MasterSystemRoleError,
  STAGING_PASSWORD_MARKER
} from "../src/master/index.js";
import type { MasterStore } from "../src/master/index.js";
import type { SqlClient } from "../src/sql-client.js";
import { count, scalar, withMigratedDb } from "./harness.js";

const hashPassword = async (password: string) => `hashed:${password}`;

function storeFor(db: Parameters<typeof createMasterStore>[0]): MasterStore {
  return createMasterStore(db, { hashPassword });
}

const division = (overrides: Partial<DivisionInput> = {}): DivisionInput => ({
  name: "Operations",
  code: "OPS",
  description: "Fleet and day-to-day operations",
  colorHex: "#2563EB",
  iconName: "heroicon-o-cog-6-tooth",
  isActive: true,
  ...overrides
});

const role = (overrides: Partial<RoleInput> = {}): RoleInput => ({
  name: "Staff",
  level: 0,
  description: "Supports daily operations",
  colorHex: "#805AD5",
  iconName: "heroicon-o-user",
  isActive: true,
  ...overrides
});

async function insertDivision(
  client: SqlClient,
  id: string,
  name = "Hub",
  code = "HUB"
): Promise<void> {
  await client.exec(
    `insert into master.divisions (id, name, code, color_hex, icon_name, is_active, created_at, updated_at)
      values ('${id}', '${name}', '${code}', '#000000', 'heroicon-o-home', true, now(), now())`
  );
}

describe("divisions store", () => {
  it("creates, reads back and updates a division", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);

      const created = await store.createDivision(division());
      expect(created).toMatchObject({
        name: "Operations",
        code: "OPS",
        isActive: true,
        deletedAt: null
      });
      expect(created.createdAt).not.toBeNull();

      await expect(store.getDivision(created.id)).resolves.toMatchObject({ id: created.id });

      const updated = await store.updateDivision(
        created.id,
        division({ name: "Operations HQ", isActive: false })
      );
      expect(updated).toMatchObject({ id: created.id, name: "Operations HQ", isActive: false });
    });
  });

  it("filters the list by search, status and trashed, and pages it", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);

      const ops = await store.createDivision(division());
      await store.createDivision(
        division({ name: "Finance", code: "FIN", description: "Budgets" })
      );
      await store.createDivision(division({ name: "Retired", code: "RET", isActive: false }));

      const all = await store.listDivisions({
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(all.total).toBe(3);
      expect(all.items.map((item) => item.name)).toEqual(["Finance", "Operations", "Retired"]);

      const search = await store.listDivisions({
        search: "budget",
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(search.items.map((item) => item.name)).toEqual(["Finance"]);

      const inactive = await store.listDivisions({
        status: "inactive",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(inactive.items.map((item) => item.name)).toEqual(["Retired"]);

      await store.deleteDivision(ops.id);
      const active = await store.listDivisions({
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(active.total).toBe(2);

      const trashed = await store.listDivisions({
        status: "all",
        trashed: "only",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(trashed.items.map((item) => item.name)).toEqual(["Operations"]);

      const page = await store.listDivisions({
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 2,
        perPage: 2
      });
      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(0);

      expect(
        await scalar<number>(client, "select count(*)::int as value from master.divisions")
      ).toBe(3);
    });
  });

  it("restores a soft-deleted division", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const created = await store.createDivision(division());

      await store.deleteDivision(created.id);
      const restored = await store.restoreDivision(created.id);

      expect(restored.deletedAt).toBeNull();
      await expect(store.restoreDivision(created.id)).rejects.toThrow(
        "Deleted division not found."
      );
    });
  });

  it("refuses duplicate names and codes with the constraint's message", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      await store.createDivision(division());

      await expect(store.createDivision(division({ code: "OPS2" }))).rejects.toThrow(
        "A division with that name already exists."
      );
      await expect(store.createDivision(division({ name: "Operations Two" }))).rejects.toThrow(
        "A division with that code already exists."
      );
    });
  });

  it("reports a missing division on read, update, delete and restore", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const missing = "00000000-0000-4000-8000-000000000000";

      await expect(store.getDivision(missing)).rejects.toThrow("Division not found.");
      await expect(store.updateDivision(missing, division())).rejects.toThrow(
        "Division not found."
      );
      await expect(store.deleteDivision(missing)).rejects.toThrow("Division not found.");
      await expect(store.restoreDivision(missing)).rejects.toThrow("Deleted division not found.");
    });
  });
});

describe("roles store", () => {
  it("creates a role with the web guard and never as a system role", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);

      const created = await store.createRole(role({ level: 2 }));

      expect(created).toMatchObject({
        name: "Staff",
        guardName: "web",
        level: 2,
        isSystem: false,
        isActive: true
      });
      await expect(store.getRole(created.id)).resolves.toMatchObject({ id: created.id });
    });
  });

  it("lists by level, search and level-desc default order", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      await store.createRole(role({ name: "Staff", level: 0 }));
      await store.createRole(role({ name: "Manager", level: 2 }));
      await store.createRole(role({ name: "Admin", level: 3, description: "Everything" }));

      const list = await store.listRoles({
        level: "all",
        active: "all",
        sort: "level",
        dir: "desc",
        page: 1,
        perPage: 10
      });
      expect(list.items.map((item) => item.name)).toEqual(["Admin", "Manager", "Staff"]);

      const managers = await store.listRoles({
        level: "2",
        active: "all",
        sort: "level",
        dir: "desc",
        page: 1,
        perPage: 10
      });
      expect(managers.items.map((item) => item.name)).toEqual(["Manager"]);

      const search = await store.listRoles({
        search: "every",
        level: "all",
        active: "all",
        sort: "level",
        dir: "desc",
        page: 1,
        perPage: 10
      });
      expect(search.items.map((item) => item.name)).toEqual(["Admin"]);
    });
  });

  it("updates and deletes an ordinary role", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const created = await store.createRole(role());

      const updated = await store.updateRole(created.id, role({ name: "Senior Staff", level: 1 }));
      expect(updated).toMatchObject({ name: "Senior Staff", level: 1 });

      await store.deleteRole(created.id);
      await expect(store.getRole(created.id)).rejects.toThrow("Role not found.");
    });
  });

  it("refuses duplicate role names", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      await store.createRole(role());

      await expect(store.createRole(role({ level: 3 }))).rejects.toThrow(
        "A role with that name already exists."
      );
    });
  });

  it("refuses to update or delete a system role", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      await client.exec(
        `insert into master.roles (id, name, guard_name, level, is_active, is_system)
          values ('00000000-0000-4000-8000-000000000002', 'Super Admin', 'web', 3, true, true)`
      );

      await expect(
        store.updateRole("00000000-0000-4000-8000-000000000002", role())
      ).rejects.toBeInstanceOf(MasterSystemRoleError);
      await expect(store.deleteRole("00000000-0000-4000-8000-000000000002")).rejects.toBeInstanceOf(
        MasterSystemRoleError
      );
      expect(await count(client, "select count(*)::int as value from master.roles")).toBe(1);
    });
  });

  it("reports a missing role", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const missing = "00000000-0000-4000-8000-000000000000";

      await expect(store.getRole(missing)).rejects.toThrow("Role not found.");
      await expect(store.updateRole(missing, role())).rejects.toThrow("Role not found.");
      await expect(store.deleteRole(missing)).rejects.toThrow("Role not found.");
    });
  });
});

describe("users store", () => {
  async function seedDivisionId(client: SqlClient, code = "OPS") {
    const id = "d1000000-0000-4000-8000-000000000001";
    await insertDivision(client, id, "Operations", code);
    return id;
  }

  const input = (
    divisionId: string,
    overrides: Partial<UserCreateInput> = {}
  ): UserCreateInput => ({
    name: "Rina Wijaya",
    email: "rina@vmblogistics.id",
    phone: "+628111000001",
    divisionId,
    status: "active",
    profilePhotoPath: "",
    password: "password123",
    passwordConfirmation: "password123",
    ...overrides
  });

  it("creates the business row and the Better Auth identity in one step", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      const store = storeFor(db);

      const created = await store.createUser(input(divisionId));

      expect(created).toMatchObject({
        name: "Rina Wijaya",
        email: "rina@vmblogistics.id",
        divisionId,
        status: "active",
        emailVerifiedAt: null
      });

      expect(
        await scalar<string>(client, `select password from master.users where id = '${created.id}'`)
      ).toBe(STAGING_PASSWORD_MARKER);
      expect(
        await scalar<string>(client, `select name from public."user" where id = '${created.id}'`)
      ).toBe("Rina Wijaya");
      expect(
        await scalar<string>(
          client,
          `select password from public.account
            where provider_id = 'credential' and account_id = '${created.id}'`
        )
      ).toBe("hashed:password123");
    });
  });

  it("lists by search, status, division and trashed", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      const otherDivisionId = "d1000000-0000-4000-8000-000000000002";
      await insertDivision(client, otherDivisionId, "Finance", "FIN");
      const store = storeFor(db);

      const rina = await store.createUser(input(divisionId));
      await store.createUser(
        input(otherDivisionId, { name: "Agus Setiawan", email: "agus@vmblogistics.id" })
      );
      await store.createUser(
        input(divisionId, {
          name: "Siti Lestari",
          email: "siti@vmblogistics.id",
          status: "suspended"
        })
      );

      const list = await store.listUsers({
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(list.total).toBe(3);
      expect(list.items.map((item) => item.name)).toEqual([
        "Agus Setiawan",
        "Rina Wijaya",
        "Siti Lestari"
      ]);

      const byDivision = await store.listUsers({
        divisionId: otherDivisionId,
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(byDivision.items.map((item) => item.name)).toEqual(["Agus Setiawan"]);

      const suspended = await store.listUsers({
        status: "suspended",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(suspended.items.map((item) => item.name)).toEqual(["Siti Lestari"]);

      const search = await store.listUsers({
        search: "rina@",
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(search.items.map((item) => item.name)).toEqual(["Rina Wijaya"]);

      await store.deleteUser(rina.id);
      const trashed = await store.listUsers({
        status: "all",
        trashed: "only",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(trashed.items.map((item) => item.name)).toEqual(["Rina Wijaya"]);
    });
  });

  it("updates the business row and keeps an existing identity in step", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      const store = storeFor(db);
      const created = await store.createUser(input(divisionId));

      const update: UserUpdateInput = {
        name: "Rina W.",
        email: "rina.w@vmblogistics.id",
        phone: "+628111000002",
        divisionId,
        status: "inactive",
        profilePhotoPath: "",
        password: "",
        passwordConfirmation: ""
      };
      const updated = await store.updateUser(created.id, update);

      expect(updated).toMatchObject({
        name: "Rina W.",
        email: "rina.w@vmblogistics.id",
        status: "inactive"
      });
      expect(
        await scalar<string>(client, `select email from public."user" where id = '${created.id}'`)
      ).toBe("rina.w@vmblogistics.id");
    });
  });

  it("changes the credential when a password is submitted", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      const store = storeFor(db);
      const created = await store.createUser(input(divisionId));

      await store.updateUser(created.id, {
        name: "Rina Wijaya",
        email: "rina@vmblogistics.id",
        phone: "+628111000001",
        divisionId,
        status: "active",
        profilePhotoPath: "",
        password: "newpassword123",
        passwordConfirmation: "newpassword123"
      });

      expect(
        await scalar<string>(
          client,
          `select password from public.account where account_id = '${created.id}'`
        )
      ).toBe("hashed:newpassword123");
    });
  });

  it("rolls the whole update back when the identity refuses the change", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      const store = storeFor(db);
      const created = await store.createUser(input(divisionId));

      // An identity Better Auth owns under an email no business row holds: the
      // signup case, where only public."user" knows the address.
      await client.exec(
        `insert into public."user" (id, name, email, email_verified, created_at, updated_at)
          values ('ffffffff-0000-4000-8000-000000000001', 'Other', 'other@vmblogistics.id', false, now(), now())`
      );

      await expect(
        store.updateUser(created.id, {
          name: "Rina Wijaya",
          email: "other@vmblogistics.id",
          phone: "+628111000001",
          divisionId,
          status: "active",
          profilePhotoPath: "",
          password: "newpassword123",
          passwordConfirmation: "newpassword123"
        })
      ).rejects.toThrow("A user with that email already exists.");

      // the business row and the credential are as they were
      expect(
        await scalar<string>(client, `select email from master.users where id = '${created.id}'`)
      ).toBe("rina@vmblogistics.id");
      expect(
        await scalar<string>(
          client,
          `select password from public.account where account_id = '${created.id}'`
        )
      ).toBe("hashed:password123");
    });
  });

  it("gives a legacy-imported user a credential when a password is set", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      await client.exec(
        `insert into master.users (id, name, status, division_id, phone, email, password, created_at, updated_at)
          values ('d2000000-0000-4000-8000-000000000099', 'Legacy User', 'active', '${divisionId}',
                  '+628111000099', 'legacy@vmblogistics.id', '!legacy', now(), now())`
      );
      const store = storeFor(db);

      await store.updateUser("d2000000-0000-4000-8000-000000000099", {
        name: "Legacy User",
        email: "legacy@vmblogistics.id",
        phone: "+628111000099",
        divisionId,
        status: "active",
        profilePhotoPath: "",
        password: "password123",
        passwordConfirmation: "password123"
      });

      expect(
        await scalar<string>(
          client,
          `select name from public."user" where id = 'd2000000-0000-4000-8000-000000000099'`
        )
      ).toBe("Legacy User");
      expect(
        await scalar<string>(
          client,
          `select password from public.account where account_id = 'd2000000-0000-4000-8000-000000000099'`
        )
      ).toBe("hashed:password123");
    });
  });

  it("soft-deletes a user and revokes their sessions, then restores them", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      const store = storeFor(db);
      const created = await store.createUser(input(divisionId));

      await client.exec(
        `insert into public.session (id, expires_at, token, created_at, updated_at, user_id)
          values ('s1', now() + interval '1 day', 'token-1', now(), now(), '${created.id}')`
      );

      await store.deleteUser(created.id);
      expect(
        await count(
          client,
          `select count(*)::int as value from public.session where user_id = '${created.id}'`
        )
      ).toBe(0);
      await expect(store.deleteUser(created.id)).rejects.toThrow("User not found.");

      const restored = await store.restoreUser(created.id);
      expect(restored.deletedAt).toBeNull();
      await expect(store.restoreUser(created.id)).rejects.toThrow("Deleted user not found.");
    });
  });

  it("refuses a duplicate email on create and update", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = await seedDivisionId(client);
      const store = storeFor(db);
      const first = await store.createUser(input(divisionId));
      await expect(
        store.createUser(input(divisionId, { name: "Other", email: "rina@vmblogistics.id" }))
      ).rejects.toThrow("A user with that email already exists.");

      const second = await store.createUser(
        input(divisionId, { name: "Agus", email: "agus@vmblogistics.id" })
      );
      await expect(
        store.updateUser(second.id, {
          name: "Agus",
          email: "rina@vmblogistics.id",
          phone: "+628111000001",
          divisionId,
          status: "active",
          profilePhotoPath: "",
          password: "",
          passwordConfirmation: ""
        })
      ).rejects.toThrow("A user with that email already exists.");
      expect(first.id).not.toBe(second.id);
    });
  });

  it("reports a missing user", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const missing = "00000000-0000-4000-8000-000000000000";

      await expect(store.getUser(missing)).rejects.toThrow("User not found.");
      await expect(
        store.updateUser(missing, {
          name: "Nobody",
          email: "nobody@example.test",
          phone: "+628111000000",
          divisionId: "00000000-0000-4000-8000-000000000001",
          status: "active",
          profilePhotoPath: "",
          password: "",
          passwordConfirmation: ""
        })
      ).rejects.toThrow("User not found.");
      await expect(store.deleteUser(missing)).rejects.toThrow("User not found.");
      await expect(store.restoreUser(missing)).rejects.toThrow("Deleted user not found.");
    });
  });
});
