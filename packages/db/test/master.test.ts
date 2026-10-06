import type { DivisionInput, RoleInput, UserCreateInput, UserUpdateInput } from "@vmb/types";
import { describe, expect, it } from "vitest";
import { createMasterStore, MasterSystemRoleError } from "../src/master/index.js";
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

async function insertRole(
  client: SqlClient,
  name: string,
  divisionId: string | null = null
): Promise<string> {
  return scalar<string>(
    client,
    `insert into master.roles (name, division_id) values ('${name}', ${divisionId ? `'${divisionId}'` : "null"})
      returning id`
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

  it("frees a Trashed division's name and code, and ignores case", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const first = await store.createDivision(division());

      await expect(
        store.createDivision(division({ name: "operations", code: "ops" }))
      ).rejects.toThrow("A division with that name already exists.");

      await store.deleteDivision(first.id);
      const second = await store.createDivision(division());

      // the Trashed one cannot come back while its name is in use
      await expect(store.restoreDivision(first.id)).rejects.toThrow(
        "A division with that name already exists."
      );
      await store.deleteDivision(second.id);
      await expect(store.restoreDivision(first.id)).resolves.toMatchObject({ id: first.id });
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
  it("creates a role that is never a system role", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);

      const created = await store.createRole(role());

      expect(created).toMatchObject({
        name: "Staff",
        isSystem: false,
        isActive: true,
        divisionId: null
      });
      await expect(store.getRole(created.id)).resolves.toMatchObject({ id: created.id });
    });
  });

  it("lists by name and search, name ascending by default", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      await store.createRole(role({ name: "Staff" }));
      await store.createRole(role({ name: "Manager" }));
      await store.createRole(role({ name: "Admin", description: "Everything" }));

      const list = await store.listRoles({
        active: "all",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(list.items.map((item) => item.name)).toEqual(["Admin", "Manager", "Staff"]);

      const search = await store.listRoles({
        search: "every",
        active: "all",
        sort: "name",
        dir: "asc",
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

      const updated = await store.updateRole(created.id, role({ name: "Senior Staff" }));
      expect(updated).toMatchObject({ name: "Senior Staff" });

      await store.deleteRole(created.id);
      await expect(store.getRole(created.id)).rejects.toThrow("Role not found.");
    });
  });

  it("refuses duplicate role names", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      await store.createRole(role());

      await expect(store.createRole(role({ description: "Another" }))).rejects.toThrow(
        "A role with that name already exists."
      );
      // case does not make a different role
      await expect(store.createRole(role({ name: "staff" }))).rejects.toThrow(
        "A role with that name already exists."
      );
    });
  });

  it("refuses to update or delete a system role", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      await client.exec(
        `insert into master.roles (id, name, is_active, is_system)
          values ('00000000-0000-4000-8000-000000000002', 'Super Admin', true, true)`
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
  // an actor who holds no roles: enough to create and edit users that get none
  const ACTOR = "00000000-0000-4000-8000-0000000000aa";

  const input = (overrides: Partial<UserCreateInput> = {}): UserCreateInput => ({
    name: "Rina Wijaya",
    email: "rina@vmblogistics.id",
    phone: "+628111000001",
    roleIds: [],
    status: "active",
    profilePhotoPath: "",
    password: "password123",
    passwordConfirmation: "password123",
    ...overrides
  });

  it("creates the business row and the Better Auth identity in one step", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);

      const created = await store.createUser(input(), ACTOR);

      expect(created).toMatchObject({
        name: "Rina Wijaya",
        email: "rina@vmblogistics.id",
        roles: [],
        status: "active",
        emailVerified: false
      });

      // #7's migration dropped the legacy auth columns; the credential lives
      // only in Better Auth's account row.
      expect(
        await scalar<number>(
          client,
          `select count(*)::int from information_schema.columns
            where table_schema = 'master' and table_name = 'users'
              and column_name in ('password', 'remember_token')`
        )
      ).toBe(0);
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

  it("reports sign-in status for an active user, a soft-deleted one, and a stranger", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);

      const created = await store.createUser(input(), ACTOR);

      await expect(store.getSignInEligibility(created.id)).resolves.toEqual({
        deletedAt: null,
        status: "active"
      });

      await store.deleteUser(created.id);
      const afterDelete = await store.getSignInEligibility(created.id);

      expect(afterDelete?.deletedAt).toEqual(expect.any(String));

      await expect(
        store.getSignInEligibility("d1000000-0000-4000-8000-0000000000ff")
      ).resolves.toBeNull();
    });
  });

  it("lists by search, status, division and trashed", async () => {
    await withMigratedDb(async (db, client) => {
      const divisionId = "d1000000-0000-4000-8000-000000000001";
      const otherDivisionId = "d1000000-0000-4000-8000-000000000002";
      await insertDivision(client, divisionId, "Operations", "OPS");
      await insertDivision(client, otherDivisionId, "Finance", "FIN");
      const operations = await insertRole(client, "Staff - Operations", divisionId);
      const finance = await insertRole(client, "Staff - Finance", otherDivisionId);
      const store = storeFor(db);

      const rina = await store.createUser(input({ roleIds: [operations] }), ACTOR);
      await store.createUser(
        input({ name: "Agus Setiawan", email: "agus@vmblogistics.id", roleIds: [finance] }),
        ACTOR
      );
      await store.createUser(
        input({
          name: "Siti Lestari",
          email: "siti@vmblogistics.id",
          status: "suspended",
          roleIds: [operations]
        }),
        ACTOR
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
      const store = storeFor(db);
      const created = await store.createUser(input(), ACTOR);

      const update: UserUpdateInput = {
        name: "Rina W.",
        email: "rina.w@vmblogistics.id",
        phone: "+628111000002",
        roleIds: [],
        status: "inactive",
        profilePhotoPath: "",
        password: "",
        passwordConfirmation: ""
      };
      const updated = await store.updateUser(created.id, update, ACTOR);

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
      const store = storeFor(db);
      const created = await store.createUser(input(), ACTOR);

      await store.updateUser(
        created.id,
        {
          name: "Rina Wijaya",
          email: "rina@vmblogistics.id",
          phone: "+628111000001",
          roleIds: [],
          status: "active",
          profilePhotoPath: "",
          password: "newpassword123",
          passwordConfirmation: "newpassword123"
        },
        ACTOR
      );

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
      const store = storeFor(db);
      const created = await store.createUser(input(), ACTOR);

      // An identity Better Auth owns under an email no business row holds: the
      // signup case, where only public."user" knows the address.
      await client.exec(
        `insert into public."user" (id, name, email, email_verified, created_at, updated_at)
          values ('ffffffff-0000-4000-8000-000000000001', 'Other', 'other@vmblogistics.id', false, now(), now())`
      );

      await expect(
        store.updateUser(
          created.id,
          {
            name: "Rina Wijaya",
            email: "other@vmblogistics.id",
            phone: "+628111000001",
            roleIds: [],
            status: "active",
            profilePhotoPath: "",
            password: "newpassword123",
            passwordConfirmation: "newpassword123"
          },
          ACTOR
        )
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
      await client.exec(
        `insert into master.users (id, name, status, phone, email, created_at, updated_at)
          values ('d2000000-0000-4000-8000-000000000099', 'Legacy User', 'active',
                  '+628111000099', 'legacy@vmblogistics.id', now(), now())`
      );
      const store = storeFor(db);

      await store.updateUser(
        "d2000000-0000-4000-8000-000000000099",
        {
          name: "Legacy User",
          email: "legacy@vmblogistics.id",
          phone: "+628111000099",
          roleIds: [],
          status: "active",
          profilePhotoPath: "",
          password: "password123",
          passwordConfirmation: "password123"
        },
        ACTOR
      );

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
      const store = storeFor(db);
      const created = await store.createUser(input(), ACTOR);

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

  it("reports email verification from Better Auth's identity", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const created = await store.createUser(input(), ACTOR);
      expect(created.emailVerified).toBe(false);

      await client.exec(
        `update public."user" set email_verified = true where id = '${created.id}'`
      );

      await expect(store.getUser(created.id)).resolves.toMatchObject({ emailVerified: true });
      const list = await store.listUsers({
        status: "all",
        trashed: "exclude",
        sort: "name",
        dir: "asc",
        page: 1,
        perPage: 10
      });
      expect(list.items[0]?.emailVerified).toBe(true);
    });
  });

  it("ends a user's sessions when their status stops being active", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const created = await store.createUser(input(), ACTOR);
      await client.exec(
        `insert into public.session (id, expires_at, token, created_at, updated_at, user_id)
          values ('s1', now() + interval '1 day', 'token-1', now(), now(), '${created.id}')`
      );

      await store.updateUser(
        created.id,
        {
          ...input(),
          password: "",
          passwordConfirmation: ""
        },
        ACTOR
      );
      expect(await count(client, `select count(*)::int as value from public.session`)).toBe(1);

      await store.updateUser(
        created.id,
        {
          ...input(),
          status: "suspended",
          password: "",
          passwordConfirmation: ""
        },
        ACTOR
      );

      expect(await count(client, `select count(*)::int as value from public.session`)).toBe(0);
      await expect(store.getSignInEligibility(created.id)).resolves.toEqual({
        deletedAt: null,
        status: "suspended"
      });
    });
  });

  it("refuses a duplicate email on create and update", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const first = await store.createUser(input(), ACTOR);
      await expect(
        store.createUser(input({ name: "Other", email: "rina@vmblogistics.id" }), ACTOR)
      ).rejects.toThrow("A user with that email already exists.");

      const second = await store.createUser(
        input({ name: "Agus", email: "agus@vmblogistics.id" }),
        ACTOR
      );
      await expect(
        store.updateUser(
          second.id,
          {
            name: "Agus",
            email: "rina@vmblogistics.id",
            phone: "+628111000001",
            roleIds: [],
            status: "active",
            profilePhotoPath: "",
            password: "",
            passwordConfirmation: ""
          },
          ACTOR
        )
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
        store.updateUser(
          missing,
          {
            name: "Nobody",
            email: "nobody@example.test",
            phone: "+628111000000",
            roleIds: [],
            status: "active",
            profilePhotoPath: "",
            password: "",
            passwordConfirmation: ""
          },
          ACTOR
        )
      ).rejects.toThrow("User not found.");
      await expect(store.deleteUser(missing)).rejects.toThrow("User not found.");
      await expect(store.restoreUser(missing)).rejects.toThrow("Deleted user not found.");
    });
  });
});
