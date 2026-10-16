import type {
  DivisionInput,
  DivisionListRequest,
  RoleInput,
  RoleListRequest,
  UserCreateInput,
  UserListRequest,
  UserUpdateInput
} from "@vmb/types";
import { describe, expect, it } from "vitest";
import { ForbiddenError } from "../src/errors.js";
import { createMasterStore } from "../src/master/index.js";
import type { MasterStore } from "../src/master/index.js";
import type { SqlClient } from "../src/sql-client.js";
import { count, scalar, transactionsOn, withMigratedDb } from "./harness.js";

const hashPassword = async (password: string) => `hashed:${password}`;

function storeFor(db: Parameters<typeof createMasterStore>[0]): MasterStore {
  return createMasterStore(db, { hashPassword, transaction: transactionsOn(db) });
}

const division = (overrides: Partial<DivisionInput> = {}): DivisionInput => ({
  name: "Operations",
  code: "OPS",
  description: "Fleet and day-to-day operations",
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: true,
  ...overrides
});

/** An edit of a record the editor loaded: the fields to save, and the `updatedAt` it read. */
const editing = <T extends object>(loaded: { updatedAt: string | null }, fields: T) => ({
  ...fields,
  updatedAt: loaded.updatedAt
});

const listQuery = (overrides: Partial<DivisionListRequest> = {}): DivisionListRequest => ({
  status: [],
  trashed: "exclude",
  sort: "name",
  dir: "asc",
  page: 1,
  perPage: 10,
  tz: "Asia/Jakarta",
  ...overrides
});

const userListQuery = (overrides: Partial<UserListRequest> = {}): UserListRequest => ({
  status: [],
  division: [],
  trashed: "exclude",
  sort: "name",
  dir: "asc",
  page: 1,
  perPage: 10,
  tz: "Asia/Jakarta",
  ...overrides
});

const roleListQuery = (overrides: Partial<RoleListRequest> = {}): RoleListRequest => ({
  status: [],
  sort: "name",
  dir: "asc",
  page: 1,
  perPage: 10,
  tz: "Asia/Jakarta",
  ...overrides
});

const role = (overrides: Partial<RoleInput> = {}): RoleInput => ({
  name: "Staff",
  description: "Supports daily operations",
  colorHex: "#805AD5",
  iconName: "user",
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
      values ('${id}', '${name}', '${code}', '#000000', 'house', true, now(), now())`
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
        editing(created, division({ name: "Operations HQ", isActive: false }))
      );
      expect(updated).toMatchObject({ id: created.id, name: "Operations HQ", isActive: false });
    });
  });

  describe("user count (#446)", () => {
    const ACTOR = { id: "00000000-0000-4000-8000-0000000000aa", permissions: [] };
    const person = (n: number, roleIds: string[]): UserCreateInput => ({
      name: `Person ${n}`,
      email: `person${n}@vmblogistics.id`,
      phone: "",
      roleIds,
      status: "active",
      profilePhotoPath: "",
      password: "password123",
      passwordConfirmation: "password123"
    });

    it("is 0 for a division no role is scoped to", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);
        const created = await store.createDivision(division());

        await expect(store.getDivision(created.id)).resolves.toMatchObject({ userCount: 0 });
      });
    });

    it("counts a user once however many of their roles are scoped to it", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        const dispatcher = await insertRole(client, "Dispatcher", hub.id);
        const driver = await insertRole(client, "Driver", hub.id);
        await store.createUser(person(1, [dispatcher, driver]), ACTOR);

        await expect(store.getDivision(hub.id)).resolves.toMatchObject({ userCount: 1 });
      });
    });

    it("leaves out a trashed user and a role scoped to another division, and counts a trashed division", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        const other = await store.createDivision(division({ name: "Finance", code: "FIN" }));
        const dispatcher = await insertRole(client, "Dispatcher", hub.id);
        const accountant = await insertRole(client, "Accountant", other.id);
        await store.createUser(person(1, [dispatcher]), ACTOR);
        const leaver = await store.createUser(person(2, [dispatcher]), ACTOR);
        await store.createUser(person(3, [accountant]), ACTOR);
        await store.deleteUser(leaver.id, ACTOR);

        await expect(store.getDivision(hub.id)).resolves.toMatchObject({ userCount: 1 });
        await expect(store.getDivision(other.id)).resolves.toMatchObject({ userCount: 1 });

        // the API refuses to Trash a division with roles (#406), so stamp it directly
        await client.exec(`update master.divisions set deleted_at = now() where id = '${hub.id}'`);
        await expect(store.getDivision(hub.id)).resolves.toMatchObject({
          userCount: 1,
          deletedAt: expect.any(String)
        });
      });
    });

    it("equals the users list's total for the same division with its defaults", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        const dispatcher = await insertRole(client, "Dispatcher", hub.id);
        const driver = await insertRole(client, "Driver", hub.id);
        await store.createUser(person(1, [dispatcher, driver]), ACTOR);
        await store.createUser(person(2, [driver]), ACTOR);
        const leaver = await store.createUser(person(3, [dispatcher]), ACTOR);
        await store.deleteUser(leaver.id, ACTOR);

        const listed = await store.listUsers(userListQuery({ division: [hub.id] }));
        const detail = await store.getDivision(hub.id);

        expect(detail.userCount).toBe(2);
        expect(detail.userCount).toBe(listed.total);
      });
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

      const all = await store.listDivisions(listQuery());
      expect(all.total).toBe(3);
      expect(all.items.map((item) => item.name)).toEqual(["Finance", "Operations", "Retired"]);

      const search = await store.listDivisions(listQuery({ search: "budget" }));
      expect(search.items.map((item) => item.name)).toEqual(["Finance"]);

      const inactive = await store.listDivisions(listQuery({ status: ["inactive"] }));
      expect(inactive.items.map((item) => item.name)).toEqual(["Retired"]);

      const either = await store.listDivisions(listQuery({ status: ["active", "inactive"] }));
      expect(either.total).toBe(3);

      await store.deleteDivision(ops.id);
      const active = await store.listDivisions(listQuery());
      expect(active.total).toBe(2);

      const trashed = await store.listDivisions(listQuery({ trashed: "only" }));
      expect(trashed.items.map((item) => item.name)).toEqual(["Operations"]);

      const page = await store.listDivisions(listQuery({ page: 2, perPage: 2 }));
      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(0);

      expect(
        await scalar<number>(client, "select count(*)::int as value from master.divisions")
      ).toBe(3);
    });
  });

  it("filters by updated and created days in the reader's zone, across a month and a year end", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const stamp = async (
        code: string,
        updatedAt: string | null,
        createdAt = "2025-06-01T00:00:00Z"
      ) =>
        client.exec(
          `update master.divisions set updated_at = ${updatedAt ? `'${updatedAt}'` : "null"},
            created_at = '${createdAt}' where code = '${code}'`
        );
      for (const [name, code] of [
        ["Year end", "YE"],
        ["New year", "NY"],
        ["Month end", "ME"],
        ["Next month", "NM"],
        ["Never", "NV"]
      ] as const) {
        await store.createDivision(division({ name, code: `${code}X` }));
      }
      // Jakarta is UTC+7: 31 Dec 23:30, 1 Jan 00:30, 31 Jan 23:59:59.999 and 1 Feb 00:00 there
      await stamp("YEX", "2025-12-31T16:30:00Z", "2025-12-31T16:30:00Z");
      await stamp("NYX", "2025-12-31T17:30:00Z", "2025-12-31T17:30:00Z");
      await stamp("MEX", "2026-01-31T16:59:59.999Z");
      await stamp("NMX", "2026-01-31T17:00:00Z");
      await stamp("NVX", null);

      const names = async (overrides: Partial<DivisionListRequest>) =>
        (await store.listDivisions(listQuery({ sort: "updatedAt", ...overrides }))).items.map(
          (item) => item.name
        );

      expect(await names({ updated: "2025-12-31..2025-12-31" })).toEqual(["Year end"]);
      expect(await names({ updated: "2025-12-31..2025-12-31", tz: "UTC" })).toEqual([
        "Year end",
        "New year"
      ]);
      expect(await names({ updated: "2026-01-01..2026-01-31" })).toEqual(["New year", "Month end"]);
      expect(await names({ updated: "2025-12-01..2026-01-31" })).toEqual([
        "Year end",
        "New year",
        "Month end"
      ]);
      expect(await names({ updated: "2026-02-01..2026-02-28" })).toEqual(["Next month"]);
      expect(await names({ created: "2026-01-01..2026-01-01" })).toEqual(["New year"]);
      expect(
        await names({ created: "2025-12-31..2026-01-01", updated: "2025-12-31..2025-12-31" })
      ).toEqual(["Year end"]);
    });
  });

  it("reads a date preset as of today in the reader's zone", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      await store.createDivision(division());
      await store.createDivision(division({ name: "Finance", code: "FIN" }));
      await client.exec(
        "update master.divisions set updated_at = '2020-03-04T05:00:00Z' where code = 'FIN'"
      );

      for (const updated of ["today", "week", "month"]) {
        const list = await store.listDivisions(listQuery({ updated }));
        expect(list.items.map((item) => item.name)).toEqual(["Operations"]);
      }
    });
  });

  it("counts each view and each status option, keeping the search and the other filters", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      await store.createDivision(division());
      await store.createDivision(division({ name: "Ops Archive", code: "OPA", isActive: false }));
      const oldOps = await store.createDivision(division({ name: "Old Ops", code: "OLD" }));
      await store.createDivision(division({ name: "Finance", code: "FIN" }));
      const oldFinance = await store.createDivision(
        division({ name: "Old Finance", code: "OFN", isActive: false })
      );
      await store.deleteDivision(oldOps.id);
      await store.deleteDivision(oldFinance.id);

      const all = await store.listDivisions(listQuery({ search: "ops" }));
      expect(all).toMatchObject({
        total: 2,
        views: { all: 2, trash: 1 },
        facets: { status: { active: 1, inactive: 1 } }
      });

      // an option's count ignores the status filter itself, so the panel can offer the others
      const inactive = await store.listDivisions(
        listQuery({ search: "ops", status: ["inactive"] })
      );
      expect(inactive).toMatchObject({
        total: 1,
        views: { all: 1, trash: 0 },
        facets: { status: { active: 1, inactive: 1 } }
      });

      const trash = await store.listDivisions(listQuery({ search: "ops", trashed: "only" }));
      expect(trash).toMatchObject({
        total: 1,
        views: { all: 2, trash: 1 },
        facets: { status: { active: 1, inactive: 0 } }
      });

      await client.exec(
        "update master.divisions set updated_at = '2020-03-04T05:00:00Z' where code = 'OPA'"
      );
      const recent = await store.listDivisions(listQuery({ search: "ops", updated: "month" }));
      expect(recent).toMatchObject({
        total: 1,
        views: { all: 1, trash: 1 },
        facets: { status: { active: 1, inactive: 0 } }
      });

      const everything = await store.listDivisions(listQuery());
      expect(everything).toMatchObject({
        total: 3,
        views: { all: 3, trash: 2 },
        facets: { status: { active: 2, inactive: 1 } }
      });
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

  it("switches a division on and off, writing only its active flag", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const created = await store.createDivision(division({ colorHex: "#112233" }));

      // a rename that lands first is not undone by the switch
      await store.updateDivision(
        created.id,
        editing(created, division({ name: "Operations HQ", colorHex: "#112233" }))
      );
      const off = await store.setDivisionActive(created.id, false);

      expect(off).toMatchObject({
        id: created.id,
        name: "Operations HQ",
        code: "OPS",
        description: "Fleet and day-to-day operations",
        colorHex: "#112233",
        iconName: "settings",
        isActive: false,
        deletedAt: null
      });
      expect(Date.parse(off.updatedAt ?? "")).toBeGreaterThanOrEqual(
        Date.parse(created.updatedAt ?? "")
      );

      await expect(store.setDivisionActive(created.id, true)).resolves.toMatchObject({
        name: "Operations HQ",
        isActive: true
      });
      // switching to the state it is already in is not an error, and leaves "Updated" alone
      const on = await store.getDivision(created.id);
      await expect(store.setDivisionActive(created.id, true)).resolves.toMatchObject({
        isActive: true,
        updatedAt: on.updatedAt
      });
      await expect(store.setDivisionActive(created.id, false)).resolves.toMatchObject({
        isActive: false
      });
    });
  });

  it("will not switch a missing or Trashed division", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const created = await store.createDivision(division());
      await store.deleteDivision(created.id);

      await expect(store.setDivisionActive(created.id, false)).rejects.toThrow(
        "Division not found."
      );
      await expect(
        store.setDivisionActive("00000000-0000-4000-8000-000000000000", false)
      ).rejects.toThrow("Division not found.");
      // and the Trashed row is left as it was
      await store.restoreDivision(created.id);
      await expect(store.getDivision(created.id)).resolves.toMatchObject({ isActive: true });
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
      await expect(
        store.updateDivision(missing, { ...division(), updatedAt: null })
      ).rejects.toThrow("Division not found.");
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

      const list = await store.listRoles(roleListQuery());
      expect(list.items.map((item) => item.name)).toEqual(["Admin", "Manager", "Staff"]);

      const search = await store.listRoles(roleListQuery({ search: "every" }));
      expect(search.items.map((item) => item.name)).toEqual(["Admin"]);
    });
  });

  it("filters by status and counts each status option under the search and other filters", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      await store.createRole(role({ name: "Staff" }));
      await store.createRole(role({ name: "Auditor", isActive: false }));
      await store.createRole(role({ name: "Admin", description: "Staff access", isActive: false }));

      const inactive = await store.listRoles(roleListQuery({ status: ["inactive"] }));
      expect(inactive.items.map((item) => item.name)).toEqual(["Admin", "Auditor"]);
      expect(inactive.total).toBe(2);
      // the counts ignore the status filter itself, so each option says what choosing it gives
      expect(inactive.facets.status).toEqual({ active: 1, inactive: 2 });

      const either = await store.listRoles(roleListQuery({ status: ["active", "inactive"] }));
      expect(either.total).toBe(3);

      const searched = await store.listRoles(roleListQuery({ search: "staff" }));
      expect(searched.items.map((item) => item.name)).toEqual(["Admin", "Staff"]);
      expect(searched.facets.status).toEqual({ active: 1, inactive: 1 });

      const page = await store.listRoles(roleListQuery({ page: 2, perPage: 2 }));
      expect(page.items.map((item) => item.name)).toEqual(["Staff"]);
      expect(page.total).toBe(3);
    });
  });

  it("filters by the days a role was updated or created, in the reader's zone", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const old = await store.createRole(role({ name: "Old" }));
      await store.createRole(role({ name: "Fresh" }));
      await client.exec(
        `update master.roles set updated_at = '2025-03-31T17:30:00Z', created_at = '2025-01-02T00:00:00Z' where id = '${old.id}'`
      );

      // 2025-03-31T17:30Z is already 1 April in Jakarta
      const april = await store.listRoles(roleListQuery({ updated: "2025-04-01..2025-04-01" }));
      expect(april.items.map((item) => item.name)).toEqual(["Old"]);
      const march = await store.listRoles(roleListQuery({ updated: "2025-03-01..2025-03-31" }));
      expect(march.items).toEqual([]);
      const created = await store.listRoles(roleListQuery({ created: "2025-01-01..2025-01-31" }));
      expect(created.items.map((item) => item.name)).toEqual(["Old"]);
    });
  });

  it("sorts by name, creation and update", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const b = await store.createRole(role({ name: "B" }));
      const a = await store.createRole(role({ name: "A" }));
      await client.exec(
        `update master.roles set created_at = '2025-01-01T00:00:00Z', updated_at = '2025-06-01T00:00:00Z' where id = '${b.id}'`
      );
      await client.exec(
        `update master.roles set created_at = '2025-02-01T00:00:00Z', updated_at = '2025-05-01T00:00:00Z' where id = '${a.id}'`
      );
      const names = async (overrides: Partial<RoleListRequest>) =>
        (await store.listRoles(roleListQuery(overrides))).items.map((item) => item.name);

      expect(await names({ sort: "name", dir: "desc" })).toEqual(["B", "A"]);
      expect(await names({ sort: "createdAt" })).toEqual(["B", "A"]);
      expect(await names({ sort: "updatedAt" })).toEqual(["A", "B"]);
      expect(await names({ sort: "updatedAt", dir: "desc" })).toEqual(["B", "A"]);
    });
  });

  it("names a role's division in its detail, and none for a role in every division", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      await insertDivision(client, "11111111-1111-4111-8111-111111111111", "Hub", "HUB");
      const scoped = await insertRole(client, "Dispatcher", "11111111-1111-4111-8111-111111111111");
      const everywhere = await store.createRole(role({ name: "Auditor" }));

      await expect(store.getRole(scoped)).resolves.toMatchObject({
        divisionId: "11111111-1111-4111-8111-111111111111",
        divisionName: "Hub"
      });
      await expect(store.getRole(everywhere.id)).resolves.toMatchObject({
        divisionId: null,
        divisionName: null
      });
    });
  });

  it("updates and deletes an ordinary role", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const created = await store.createRole(role());

      const updated = await store.updateRole(
        created.id,
        editing(created, role({ name: "Senior Staff" }))
      );
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
        store.updateRole("00000000-0000-4000-8000-000000000002", { ...role(), updatedAt: null })
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(store.deleteRole("00000000-0000-4000-8000-000000000002")).rejects.toMatchObject({
        code: "SYSTEM_ROLE"
      });
      expect(await count(client, "select count(*)::int as value from master.roles")).toBe(1);
    });
  });

  it("reports a missing role", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const missing = "00000000-0000-4000-8000-000000000000";

      await expect(store.getRole(missing)).rejects.toThrow("Role not found.");
      await expect(store.updateRole(missing, { ...role(), updatedAt: null })).rejects.toThrow(
        "Role not found."
      );
      await expect(store.deleteRole(missing)).rejects.toThrow("Role not found.");
    });
  });
});

describe("users store", () => {
  // an actor who holds no permissions: enough to create and edit users that get none
  const ACTOR = { id: "00000000-0000-4000-8000-0000000000aa", permissions: [] };

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

      await store.deleteUser(created.id, ACTOR);
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

      const list = await store.listUsers(userListQuery());
      expect(list.total).toBe(3);
      expect(list.items.map((item) => item.name)).toEqual([
        "Agus Setiawan",
        "Rina Wijaya",
        "Siti Lestari"
      ]);

      const byDivision = await store.listUsers(userListQuery({ division: [otherDivisionId] }));
      expect(byDivision.items.map((item) => item.name)).toEqual(["Agus Setiawan"]);

      const suspended = await store.listUsers(userListQuery({ status: ["suspended"] }));
      expect(suspended.items.map((item) => item.name)).toEqual(["Siti Lestari"]);

      const search = await store.listUsers(userListQuery({ search: "rina@" }));
      expect(search.items.map((item) => item.name)).toEqual(["Rina Wijaya"]);

      await store.deleteUser(rina.id, ACTOR);
      const trashed = await store.listUsers(userListQuery({ trashed: "only" }));
      expect(trashed.items.map((item) => item.name)).toEqual(["Rina Wijaya"]);
    });
  });

  it("filters by several statuses and divisions, and counts every option under the other filters", async () => {
    await withMigratedDb(async (db, client) => {
      const ops = "d1000000-0000-4000-8000-000000000001";
      const fin = "d1000000-0000-4000-8000-000000000002";
      await insertDivision(client, ops, "Operations", "OPS");
      await insertDivision(client, fin, "Finance", "FIN");
      const operations = await insertRole(client, "Staff - Operations", ops);
      const finance = await insertRole(client, "Staff - Finance", fin);
      const store = storeFor(db);

      const rina = await store.createUser(input({ roleIds: [operations, finance] }), ACTOR);
      await store.createUser(
        input({ name: "Agus", email: "agus@vmblogistics.id", roleIds: [finance] }),
        ACTOR
      );
      await store.createUser(
        input({
          name: "Siti",
          email: "siti@vmblogistics.id",
          status: "suspended",
          roleIds: [operations]
        }),
        ACTOR
      );
      const leaver = await store.createUser(
        input({ name: "Budi", email: "budi@vmblogistics.id", status: "inactive" }),
        ACTOR
      );
      await store.deleteUser(leaver.id, ACTOR);

      // a user holds each division once, however many roles are scoped to it
      const all = await store.listUsers(userListQuery());
      expect(all.items.find((item) => item.id === rina.id)?.divisions).toEqual([
        { id: fin, name: "Finance" },
        { id: ops, name: "Operations" }
      ]);
      expect(all.items.find((item) => item.name === "Agus")?.divisions).toEqual([
        { id: fin, name: "Finance" }
      ]);

      // several divisions are "any of them", and each user is listed once
      const either = await store.listUsers(userListQuery({ division: [ops, fin] }));
      expect(either.items.map((item) => item.name)).toEqual(["Agus", "Rina Wijaya", "Siti"]);
      expect(either.total).toBe(3);

      const picked = await store.listUsers(userListQuery({ status: ["active", "suspended"] }));
      expect(picked.items.map((item) => item.name)).toEqual(["Agus", "Rina Wijaya", "Siti"]);

      // each count leaves out its own filter, and keeps the others and the view
      const narrowed = await store.listUsers(
        userListQuery({ status: ["suspended"], division: [fin] })
      );
      expect(narrowed.items).toEqual([]);
      expect(narrowed.views).toEqual({ all: 0, trash: 0 });
      expect(narrowed.facets.status).toEqual({ active: 2, inactive: 0, suspended: 0 });
      expect(narrowed.facets.division).toEqual({ [ops]: 1 });

      const base = await store.listUsers(userListQuery());
      expect(base.views).toEqual({ all: 3, trash: 1 });
      expect(base.facets.status).toEqual({ active: 2, inactive: 0, suspended: 1 });
      expect(base.facets.division).toEqual({ [ops]: 2, [fin]: 2 });

      const trash = await store.listUsers(userListQuery({ trashed: "only" }));
      expect(trash.items.map((item) => item.name)).toEqual(["Budi"]);
      expect(trash.facets.status).toEqual({ active: 0, inactive: 1, suspended: 0 });
      expect(trash.facets.division).toEqual({});

      // the date filters read the reader's days
      const today = await store.listUsers(userListQuery({ created: "today" }));
      expect(today.total).toBe(3);
      const last = await store.listUsers(userListQuery({ created: "2020-01-01..2020-01-31" }));
      expect(last.total).toBe(0);
    });
  });

  it("refuses a role of an Inactive Division for a new user, and for a role newly added, but not one already held", async () => {
    await withMigratedDb(async (db, client) => {
      const hub = "d1000000-0000-4000-8000-000000000001";
      await insertDivision(client, hub, "Hub", "HUB");
      const scoped = await insertRole(client, "Hub staff", hub);
      const anywhere = await insertRole(client, "Anywhere");
      const store = storeFor(db);

      // an Active Division: the role can be given
      const held = await store.createUser(input({ roleIds: [scoped] }), ACTOR);
      await client.exec(`update master.divisions set is_active = false where id = '${hub}'`);

      // saving the user as they are keeps the role they hold
      const saved = await store.updateUser(
        held.id,
        {
          name: "Rina W.",
          email: held.email,
          phone: held.phone ?? "",
          roleIds: [scoped],
          status: "active",
          profilePhotoPath: "",
          password: "",
          passwordConfirmation: "",
          updatedAt: held.updatedAt
        },
        ACTOR
      );
      expect(saved.roles.map((role) => role.id)).toEqual([scoped]);

      // a new user cannot be given it, and the message says which role
      await expect(
        store.createUser(
          input({ email: "new@vmblogistics.id", roleIds: [scoped, anywhere] }),
          ACTOR
        )
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        issues: [{ path: "roleIds", message: expect.stringContaining("“Hub staff”") }]
      });
      expect(
        await scalar<number>(
          client,
          `select count(*)::int from master.users where email = 'new@vmblogistics.id'`
        )
      ).toBe(0);

      // another user cannot be given it by an edit either
      const other = await store.createUser(
        input({ email: "other@vmblogistics.id", roleIds: [anywhere] }),
        ACTOR
      );
      await expect(
        store.updateUser(
          other.id,
          {
            name: other.name,
            email: other.email,
            phone: other.phone ?? "",
            roleIds: [anywhere, scoped],
            status: "active",
            profilePhotoPath: "",
            password: "",
            passwordConfirmation: "",
            updatedAt: other.updatedAt
          },
          ACTOR
        )
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      await expect(store.getUser(other.id)).resolves.toMatchObject({
        roles: [{ id: anywhere }]
      });

      // taking it away is always allowed
      const freed = await store.updateUser(
        held.id,
        {
          name: saved.name,
          email: saved.email,
          phone: saved.phone ?? "",
          roleIds: [],
          status: "active",
          profilePhotoPath: "",
          password: "",
          passwordConfirmation: "",
          updatedAt: saved.updatedAt
        },
        ACTOR
      );
      expect(freed.roles).toEqual([]);
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
        passwordConfirmation: "",
        updatedAt: created.updatedAt
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
          passwordConfirmation: "newpassword123",
          updatedAt: created.updatedAt
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
            passwordConfirmation: "newpassword123",
            updatedAt: created.updatedAt
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
          passwordConfirmation: "password123",
          updatedAt: await scalar<string>(
            client,
            `select to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as value
               from master.users where id = 'd2000000-0000-4000-8000-000000000099'`
          )
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

      await store.deleteUser(created.id, ACTOR);
      expect(
        await count(
          client,
          `select count(*)::int as value from public.session where user_id = '${created.id}'`
        )
      ).toBe(0);
      await expect(store.deleteUser(created.id, ACTOR)).rejects.toThrow("User not found.");

      const restored = await store.restoreUser(created.id, ACTOR);
      expect(restored.deletedAt).toBeNull();
      await expect(store.restoreUser(created.id, ACTOR)).rejects.toThrow("Deleted user not found.");
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
      const list = await store.listUsers(userListQuery());
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
          passwordConfirmation: "",
          updatedAt: created.updatedAt
        },
        ACTOR
      );
      expect(await count(client, `select count(*)::int as value from public.session`)).toBe(1);

      const afterFirst = await store.getUser(created.id);
      await store.updateUser(
        created.id,
        {
          ...input(),
          status: "suspended",
          password: "",
          passwordConfirmation: "",
          updatedAt: afterFirst.updatedAt
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
      ).rejects.toMatchObject({
        code: "CONFLICT",
        issues: [{ path: "email", message: "A user with that email already exists." }]
      });

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
            passwordConfirmation: "",
            updatedAt: second.updatedAt
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
            passwordConfirmation: "",
            updatedAt: null
          },
          ACTOR
        )
      ).rejects.toThrow("User not found.");
      await expect(store.deleteUser(missing, ACTOR)).rejects.toThrow("User not found.");
      await expect(store.restoreUser(missing, ACTOR)).rejects.toThrow("Deleted user not found.");
    });
  });
});

describe("edits over a newer save", () => {
  const ACTOR = { id: "00000000-0000-4000-8000-0000000000aa", permissions: [] };
  const missing = "00000000-0000-4000-8000-000000000000";

  const newUser = (overrides: Partial<UserCreateInput> = {}): UserCreateInput => ({
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

  const userEdit = (
    loaded: { name: string; email: string; phone: string | null; updatedAt: string | null },
    overrides: Partial<UserUpdateInput> = {}
  ): UserUpdateInput => ({
    name: loaded.name,
    email: loaded.email,
    phone: loaded.phone ?? "",
    status: "active",
    profilePhotoPath: "",
    password: "",
    passwordConfirmation: "",
    updatedAt: loaded.updatedAt,
    ...overrides
  });

  it("saves a division with the updatedAt it loaded and refuses an older one, changing nothing", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const loaded = await store.createDivision(division());

      const first = await store.updateDivision(
        loaded.id,
        editing(loaded, division({ name: "Operations HQ" }))
      );
      expect(first.name).toBe("Operations HQ");
      expect(first.updatedAt).not.toBe(loaded.updatedAt);

      // a second editor still holding the first load
      await expect(
        store.updateDivision(loaded.id, editing(loaded, division({ name: "Operations West" })))
      ).rejects.toMatchObject({
        code: "STALE_RECORD",
        issues: [{ path: "updatedAt" }]
      });
      await expect(store.getDivision(loaded.id)).resolves.toEqual({ ...first, userCount: 0 });

      // reloading and saving again goes through
      await expect(
        store.updateDivision(loaded.id, editing(first, division({ name: "Operations West" })))
      ).resolves.toMatchObject({ name: "Operations West" });
    });
  });

  it("tells a stale division from a missing one", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const loaded = await store.createDivision(division());

      await expect(
        store.updateDivision(loaded.id, { ...division(), updatedAt: "2020-01-01T00:00:00.000Z" })
      ).rejects.toMatchObject({ code: "STALE_RECORD" });
      await expect(
        store.updateDivision(missing, editing(loaded, division()))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  it("compares at the millisecond the column keeps, for a stamp written by the database's clock", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      // `now()` carries microseconds; the column keeps milliseconds and so does the API
      await insertDivision(client, "d1000000-0000-4000-8000-000000000001");
      const loaded = await store.getDivision("d1000000-0000-4000-8000-000000000001");
      expect(loaded.updatedAt).toMatch(/\.\d{3}Z$/);

      await expect(
        store.updateDivision(loaded.id, editing(loaded, division({ name: "Hub 2", code: "HUB" })))
      ).resolves.toMatchObject({ name: "Hub 2" });

      // one millisecond off is a different version. The millisecond before the
      // current stamp, not the one after the loaded one: `nextStamp` writes
      // `greatest(now(), updated_at + 1 ms)`, so a save landing within a
      // millisecond of the insert reissues exactly `loaded + 1 ms`. Stamps only
      // move forward, so no write can land on the millisecond before the current.
      const current = await store.getDivision(loaded.id);
      const off = new Date(Date.parse(current.updatedAt ?? "") - 1).toISOString();
      expect(current.updatedAt).not.toBe(off);
      await expect(
        store.updateDivision(loaded.id, { ...division(), updatedAt: off })
      ).rejects.toMatchObject({ code: "STALE_RECORD" });
    });
  });

  it("edits a division that was never stamped, and refuses a stamp for it", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const created = await store.createDivision(division());
      await client.exec(`update master.divisions set updated_at = null where id = '${created.id}'`);

      await expect(
        store.updateDivision(created.id, { ...division(), updatedAt: created.updatedAt })
      ).rejects.toMatchObject({ code: "STALE_RECORD" });
      const saved = await store.updateDivision(created.id, { ...division(), updatedAt: null });
      expect(saved.updatedAt).not.toBeNull();
    });
  });

  it("moves a record's updatedAt past the one it replaces, so a stamp in the same millisecond is never reissued", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const division_ = await store.createDivision(division());
      const role_ = await store.createRole(role());
      const user_ = await store.createUser(
        {
          name: "Rina Wijaya",
          email: "rina@vmblogistics.id",
          phone: "+628111000001",
          roleIds: [],
          status: "active",
          profilePhotoPath: "",
          password: "password123",
          passwordConfirmation: "password123"
        },
        { id: "00000000-0000-4000-8000-0000000000aa", permissions: [] }
      );
      // a stamp the database's clock has not reached yet, as a save a moment ago in the same millisecond would leave
      const ahead = "2999-01-01T00:00:00.000Z";
      for (const [table, id] of [
        ["divisions", division_.id],
        ["roles", role_.id],
        ["users", user_.id]
      ]) {
        await client.exec(`update master.${table} set updated_at = '${ahead}' where id = '${id}'`);
      }
      const after = "2999-01-01T00:00:00.001Z";

      const saved = [
        await store.updateDivision(division_.id, { ...division(), updatedAt: ahead }),
        await store.updateRole(role_.id, { ...role(), updatedAt: ahead }),
        await store.updateUser(
          user_.id,
          {
            name: user_.name,
            email: user_.email,
            phone: user_.phone ?? "",
            status: "active",
            profilePhotoPath: "",
            password: "",
            passwordConfirmation: "",
            updatedAt: ahead
          },
          { id: "00000000-0000-4000-8000-0000000000aa", permissions: [] }
        )
      ];

      expect(saved.map((record) => record.updatedAt)).toEqual([after, after, after]);
    });
  });

  it("lets exactly one of two saves from the same load win: the check and the write are one statement", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const loaded = await store.createDivision(division());

      // both are in flight before either lands, so a read first and a write after would let both through
      const results = await Promise.allSettled([
        store.updateDivision(loaded.id, editing(loaded, division({ name: "Ada" }))),
        store.updateDivision(loaded.id, editing(loaded, division({ name: "Budi" })))
      ]);

      expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
      const lost = results.find((result) => result.status === "rejected");
      expect(lost).toMatchObject({ reason: { code: "STALE_RECORD" } });
      const winner = results.find((result) => result.status === "fulfilled");
      await expect(store.getDivision(loaded.id)).resolves.toEqual(
        winner?.status === "fulfilled" ? { ...winner.value, userCount: 0 } : undefined
      );
    });
  });

  it("refuses a stale role save, keeps the row, and still answers a missing or system role as before", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const loaded = await store.createRole(role());
      const first = await store.updateRole(loaded.id, editing(loaded, role({ name: "Senior" })));

      await expect(
        store.updateRole(loaded.id, editing(loaded, role({ name: "Junior" })))
      ).rejects.toMatchObject({ code: "STALE_RECORD", issues: [{ path: "updatedAt" }] });
      await expect(store.getRole(loaded.id)).resolves.toEqual({ ...first, divisionName: null });

      await expect(store.updateRole(missing, editing(loaded, role()))).rejects.toMatchObject({
        code: "NOT_FOUND"
      });
      await client.exec(`update master.roles set is_system = true where id = '${loaded.id}'`);
      await expect(store.updateRole(loaded.id, editing(first, role()))).rejects.toMatchObject({
        code: "SYSTEM_ROLE"
      });
    });
  });

  it("lets exactly one of two role saves from the same load win", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const loaded = await store.createRole(role());

      const results = await Promise.allSettled([
        store.updateRole(loaded.id, editing(loaded, role({ name: "Ada" }))),
        store.updateRole(loaded.id, editing(loaded, role({ name: "Budi" })))
      ]);

      expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    });
  });

  it("refuses a stale user save and changes nothing: row, identity, credential, roles, sessions", async () => {
    await withMigratedDb(async (db, client) => {
      const store = storeFor(db);
      const staff = await insertRole(client, "Staff");
      const created = await store.createUser(newUser(), ACTOR);
      await client.exec(
        `insert into public.session (id, expires_at, token, created_at, updated_at, user_id)
          values ('s1', now() + interval '1 day', 'token-1', now(), now(), '${created.id}')`
      );

      // someone else saves first, with a password and a role
      const first = await store.updateUser(
        created.id,
        userEdit(created, {
          name: "Rina W.",
          roleIds: [staff],
          password: "firstpassword1",
          passwordConfirmation: "firstpassword1"
        }),
        ACTOR
      );
      expect(first.updatedAt).not.toBe(created.updatedAt);

      // the second editor, still holding the first load, tries everything at once
      for (const password of ["", "secondpassword2"]) {
        await expect(
          store.updateUser(
            created.id,
            userEdit(created, {
              name: "Rina Z.",
              email: "rina.z@vmblogistics.id",
              status: "suspended",
              roleIds: [],
              password,
              passwordConfirmation: password
            }),
            ACTOR
          )
        ).rejects.toMatchObject({ code: "STALE_RECORD", issues: [{ path: "updatedAt" }] });
      }

      await expect(store.getUser(created.id)).resolves.toEqual(first);
      expect(
        await scalar<string>(client, `select name from public."user" where id = '${created.id}'`)
      ).toBe("Rina W.");
      expect(
        await scalar<string>(client, `select email from public."user" where id = '${created.id}'`)
      ).toBe("rina@vmblogistics.id");
      expect(
        await scalar<string>(
          client,
          `select password from public.account where account_id = '${created.id}'`
        )
      ).toBe("hashed:firstpassword1");
      expect(
        await count(
          client,
          `select count(*)::int as value from master.user_roles where user_id = '${created.id}'`
        )
      ).toBe(1);
      expect(await count(client, `select count(*)::int as value from public.session`)).toBe(1);

      // reloading and saving again goes through
      await expect(
        store.updateUser(created.id, userEdit(first, { name: "Rina Z." }), ACTOR)
      ).resolves.toMatchObject({ name: "Rina Z." });
    });
  });

  it("tells a stale user from a missing one, and lets one of two saves from the same load win", async () => {
    await withMigratedDb(async (db) => {
      const store = storeFor(db);
      const loaded = await store.createUser(newUser(), ACTOR);

      await expect(store.updateUser(missing, userEdit(loaded), ACTOR)).rejects.toMatchObject({
        code: "NOT_FOUND"
      });

      const results = await Promise.allSettled([
        store.updateUser(loaded.id, userEdit(loaded, { name: "Ada" }), ACTOR),
        store.updateUser(loaded.id, userEdit(loaded, { name: "Budi" }), ACTOR)
      ]);
      expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        reason: { code: "STALE_RECORD" }
      });
    });
  });
});

describe("a Trashed record is read-only until restored (ADR-0055)", () => {
  const ACTOR = { id: "00000000-0000-4000-8000-0000000000aa", permissions: [] };

  const newUser = (overrides: Partial<UserCreateInput> = {}): UserCreateInput => ({
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

  const userEdit = (
    loaded: { name: string; email: string; phone: string | null; updatedAt: string | null },
    overrides: Partial<UserUpdateInput> = {}
  ): UserUpdateInput => ({
    name: loaded.name,
    email: loaded.email,
    phone: loaded.phone ?? "",
    status: "active",
    profilePhotoPath: "",
    password: "",
    passwordConfirmation: "",
    updatedAt: loaded.updatedAt,
    ...overrides
  });

  describe("divisions", () => {
    it("refuses an edit, a switch and a second delete, and leaves the row as the delete left it", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);
        const created = await store.createDivision(division());
        await store.deleteDivision(created.id);
        const trashed = await store.getDivision(created.id);
        expect(trashed.deletedAt).not.toBeNull();

        // a missing record to the writer: 404, never the 409 a live record that changed gets
        const edits = [
          editing(trashed, division({ name: "Renamed" })),
          // a form opened before the delete, submitted after it
          editing(created, division({ name: "Renamed" }))
        ];
        for (const edit of edits) {
          await expect(store.updateDivision(created.id, edit)).rejects.toMatchObject({
            code: "NOT_FOUND",
            message: "Division not found."
          });
        }
        for (const isActive of [true, false]) {
          await expect(store.setDivisionActive(created.id, isActive)).rejects.toMatchObject({
            code: "NOT_FOUND"
          });
        }
        await expect(store.deleteDivision(created.id)).rejects.toMatchObject({
          code: "NOT_FOUND"
        });

        // neither the deletion date nor "Updated" moved, and the row can still be read
        await expect(store.getDivision(created.id)).resolves.toEqual(trashed);
      });
    });

    it("settles a delete racing an edit, in either order, with the row deleted and never edited after", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);

        // the edit lands first: it is kept, and the row ends up deleted
        const first = await store.createDivision(division());
        await store.updateDivision(first.id, editing(first, division({ name: "Edited first" })));
        await store.deleteDivision(first.id);
        await expect(store.getDivision(first.id)).resolves.toMatchObject({
          name: "Edited first",
          deletedAt: expect.any(String)
        });

        // the delete lands first: the edit is refused and changes nothing
        const second = await store.createDivision(division({ name: "Second", code: "SND" }));
        await store.deleteDivision(second.id);
        await expect(
          store.updateDivision(second.id, editing(second, division({ name: "Edited after" })))
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(store.getDivision(second.id)).resolves.toMatchObject({ name: "Second" });

        // both in flight at once, either order: whichever the database runs first, the row ends
        // up deleted, and it carries the edit only if the edit was the one accepted
        for (const order of ["edit first", "delete first"] as const) {
          const raced = await store.createDivision(
            division({ name: `Raced ${order}`, code: order === "edit first" ? "RC1" : "RC2" })
          );
          const edit = () =>
            store.updateDivision(raced.id, editing(raced, division({ name: "Edited" })));
          const remove = () => store.deleteDivision(raced.id);
          const results = await Promise.allSettled(
            order === "edit first" ? [edit(), remove()] : [remove(), edit()]
          );
          const edited = results[order === "edit first" ? 0 : 1];
          const after = await store.getDivision(raced.id);

          expect(after.deletedAt).not.toBeNull();
          expect(after.name).toBe(edited?.status === "fulfilled" ? "Edited" : `Raced ${order}`);
          if (edited?.status === "rejected") {
            expect(edited.reason).toMatchObject({ code: "NOT_FOUND" });
          }
        }
      });
    });

    it("makes a form opened before a delete and restore stale, and a fresh one succeed", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);
        const loaded = await store.createDivision(division());

        await store.deleteDivision(loaded.id);
        const restored = await store.restoreDivision(loaded.id);
        expect(restored.updatedAt).not.toBe(loaded.updatedAt);

        await expect(
          store.updateDivision(loaded.id, editing(loaded, division({ name: "Stale" })))
        ).rejects.toMatchObject({ code: "STALE_RECORD", issues: [{ path: "updatedAt" }] });
        await expect(
          store.updateDivision(loaded.id, editing(restored, division({ name: "Fresh" })))
        ).resolves.toMatchObject({ name: "Fresh", deletedAt: null });
      });
    });

    it("refuses to restore over a code reused meanwhile, naming the code, and keeps both rows as they were", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);
        const first = await store.createDivision(division());
        await store.deleteDivision(first.id);
        const reuse = await store.createDivision(division({ name: "Operations Two" }));

        await expect(store.restoreDivision(first.id)).rejects.toMatchObject({
          code: "CONFLICT",
          message: "A division with that code already exists.",
          issues: [{ path: "code" }]
        });
        await expect(store.getDivision(first.id)).resolves.toMatchObject({
          deletedAt: expect.any(String)
        });
        await expect(store.getDivision(reuse.id)).resolves.toEqual({ ...reuse, userCount: 0 });

        // once the code is free again, the restore goes through
        await store.deleteDivision(reuse.id);
        await expect(store.restoreDivision(first.id)).resolves.toMatchObject({ deletedAt: null });
      });
    });

    it("keeps the roles of a division Trashed before the refusal, and their holders, and drops it from where they belong until restored", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        const staff = await insertRole(client, "Staff", hub.id);
        await client.exec(
          `insert into master.role_permissions (role_id, permission_key) values ('${staff}', 'master-users.view_any')`
        );
        const rina = await store.createUser(newUser({ roleIds: [staff] }), {
          ...ACTOR,
          permissions: ["master-users.view_any"]
        });

        // a division Trashed before it was refused while it had roles (#406): its roles stay attached
        await client.exec(`update master.divisions set deleted_at = now() where id = '${hub.id}'`);

        // nothing cascades: the role stays scoped to the Trashed division and its holder keeps it
        await expect(store.getRole(staff)).resolves.toMatchObject({ divisionId: hub.id });
        await expect(store.getUser(rina.id)).resolves.toMatchObject({
          roles: [{ id: staff, name: "Staff" }]
        });
        // and so are its permissions: a division scopes a role but grants nothing itself
        await expect(store.getPermissions(rina.id)).resolves.toEqual(["master-users.view_any"]);
        // but the division is no longer one the user belongs to
        await expect(store.getAccess(rina.id)).resolves.toMatchObject({ divisions: [] });

        await store.restoreDivision(hub.id);
        await expect(store.getAccess(rina.id)).resolves.toMatchObject({
          divisions: [{ id: hub.id }]
        });
      });
    });
  });

  describe("deleting a division that still has roles (#406)", () => {
    const refusal = (roles: number) => ({
      code: "DIVISION_IN_USE",
      message:
        roles === 1
          ? "1 role belongs to this division. Move it to another division or delete it first."
          : `${roles} roles belong to this division. Move them to another division or delete them first.`
    });

    it("refuses while any role belongs to it, names the count and changes nothing", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        const first = await insertRole(client, "Dispatcher", hub.id);

        await expect(store.deleteDivision(hub.id)).rejects.toMatchObject(refusal(1));
        await insertRole(client, "Driver", hub.id);
        await expect(store.deleteDivision(hub.id)).rejects.toMatchObject(refusal(2));

        // the row, its stamp and its roles are as they were
        await expect(store.getDivision(hub.id)).resolves.toEqual({ ...hub, userCount: 0 });
        expect(
          await count(
            client,
            `select count(*)::int as value from master.roles where division_id = '${hub.id}'`
          )
        ).toBe(2);

        // roles do not soft-delete, so deleting them is what lets the division go
        await client.exec(`delete from master.roles where division_id = '${hub.id}'`);
        await expect(store.deleteDivision(hub.id)).resolves.toBeUndefined();
        await expect(store.getDivision(hub.id)).resolves.toMatchObject({
          deletedAt: expect.any(String)
        });
        expect(first).toBeTruthy();
      });
    });

    it("lets one go once its roles are moved to another division, and ignores other divisions' roles", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        const other = await store.createDivision(division({ name: "Other", code: "OTH" }));
        const role = await insertRole(client, "Dispatcher", hub.id);

        await expect(store.deleteDivision(other.id)).resolves.toBeUndefined();

        await client.exec(`update master.roles set division_id = null where id = '${role}'`);
        await expect(store.deleteDivision(hub.id)).resolves.toBeUndefined();
      });
    });

    it("answers a missing or already Trashed division with 404, not the refusal", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        await expect(
          store.deleteDivision("00000000-0000-4000-8000-000000000000")
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        // a Trashed one that still has roles (Trashed before the rule): it is out of reach, not in use
        await insertRole(client, "Dispatcher", hub.id);
        await client.exec(`update master.divisions set deleted_at = now() where id = '${hub.id}'`);
        await expect(store.deleteDivision(hub.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      });
    });

    it("decides inside the delete: one statement, with no read ahead of it", async () => {
      await withMigratedDb(async (db, client, statements) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        await insertRole(client, "Dispatcher", hub.id);
        const free = await store.createDivision(division({ name: "Free", code: "FRE" }));

        statements.length = 0;
        await store.deleteDivision(free.id);
        expect(statements).toHaveLength(1);
        expect(statements[0]).toMatch(/^update "master"\."divisions"/);
        expect(statements[0]).toMatch(/not exists \(select 1 from "master"\."roles"/);
      });
    });

    it("settles a role added racing the delete, in either order: the role first refuses the delete", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const outcomes: string[] = [];

        for (const order of ["role first", "delete first"] as const) {
          const raced = await store.createDivision(
            division({
              name: `Raced ${order}`,
              code: order === "role first" ? "RC1" : "RC2"
            })
          );
          const add = () => insertRole(client, `Role ${order}`, raced.id);
          const remove = () => store.deleteDivision(raced.id);
          // both in flight at once, either order: whichever the database runs first, a division
          // whose role is in before the delete ran is refused and left live
          const [added, removed] =
            order === "role first"
              ? await Promise.allSettled([add(), remove()])
              : (await Promise.allSettled([remove(), add()])).reverse();
          const after = await store.getDivision(raced.id);

          expect(added?.status).toBe("fulfilled");
          if (removed?.status === "fulfilled") {
            expect(after.deletedAt).not.toBeNull();
          } else {
            expect(removed?.reason).toMatchObject({ code: "DIVISION_IN_USE" });
            expect(after.deletedAt).toBeNull();
          }
          outcomes.push(removed?.status ?? "none");
        }
        // sent first, the role is what the delete meets
        expect(outcomes[0]).toBe("rejected");
      });
    });

    it("still restores a Trashed division that has roles", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const hub = await store.createDivision(division());
        await insertRole(client, "Dispatcher", hub.id);
        await client.exec(`update master.divisions set deleted_at = now() where id = '${hub.id}'`);

        await expect(store.restoreDivision(hub.id)).resolves.toMatchObject({
          id: hub.id,
          deletedAt: null
        });
      });
    });
  });

  describe("users", () => {
    it("refuses every kind of edit to a Trashed user and changes nothing: row, identity, credential, roles, sessions", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const staff = await insertRole(client, "Staff");
        const other = await insertRole(client, "Other");
        const created = await store.createUser(newUser({ roleIds: [staff] }), ACTOR);
        await store.deleteUser(created.id, ACTOR);
        const trashed = await store.getUser(created.id);
        const row = `select name, email, status, updated_at, deleted_at from master.users where id = '${created.id}'`;
        const before = await client.query(row);

        const attempts: Array<[string, UserUpdateInput]> = [
          ["a rename", userEdit(trashed, { name: "Rina Z." })],
          // the form's stamp from before the delete is no reason to answer 409 either
          ["a stale form", userEdit(created, { name: "Rina Z." })],
          ["a status change", userEdit(trashed, { status: "suspended" })],
          ["a role assignment", userEdit(trashed, { roleIds: [other] })],
          ["a role removal", userEdit(trashed, { roleIds: [] })],
          [
            "a password reset",
            userEdit(trashed, {
              password: "secondpassword2",
              passwordConfirmation: "secondpassword2"
            })
          ],
          ["an email change", userEdit(trashed, { email: "rina.z@vmblogistics.id" })]
        ];
        for (const [what, attempt] of attempts) {
          await expect(store.updateUser(created.id, attempt, ACTOR), what).rejects.toMatchObject({
            code: "NOT_FOUND",
            message: "User not found."
          });
        }

        expect(await client.query(row)).toEqual(before);
        await expect(store.getUser(created.id)).resolves.toEqual(trashed);
        expect(
          await scalar<string>(client, `select email from public."user" where id = '${created.id}'`)
        ).toBe("rina@vmblogistics.id");
        expect(
          await scalar<string>(
            client,
            `select password from public.account where account_id = '${created.id}'`
          )
        ).toBe("hashed:password123");
        expect(
          await scalar<string>(
            client,
            `select role_id from master.user_roles where user_id = '${created.id}'`
          )
        ).toBe(staff);
        expect(await count(client, `select count(*)::int as value from public.session`)).toBe(0);
      });
    });

    it("settles a delete racing an edit in either order, with the user deleted and never edited after", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);

        for (const order of ["edit first", "delete first"] as const) {
          const raced = await store.createUser(
            newUser({
              name: `Raced ${order}`,
              email: order === "edit first" ? "one@vmblogistics.id" : "two@vmblogistics.id"
            }),
            ACTOR
          );
          const edit = () => store.updateUser(raced.id, userEdit(raced, { name: "Edited" }), ACTOR);
          const remove = () => store.deleteUser(raced.id, ACTOR);
          const results = await Promise.allSettled(
            order === "edit first" ? [edit(), remove()] : [remove(), edit()]
          );
          const edited = results[order === "edit first" ? 0 : 1];
          const after = await store.getUser(raced.id);

          expect(after.deletedAt).not.toBeNull();
          expect(after.name).toBe(edited?.status === "fulfilled" ? "Edited" : `Raced ${order}`);
          if (edited?.status === "rejected") {
            expect(edited.reason).toMatchObject({ code: "NOT_FOUND" });
          }
        }
      });
    });

    it("makes a form opened before a delete and restore stale, and a fresh one succeed", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);
        const loaded = await store.createUser(newUser(), ACTOR);

        await store.deleteUser(loaded.id, ACTOR);
        const restored = await store.restoreUser(loaded.id, ACTOR);
        expect(restored.updatedAt).not.toBe(loaded.updatedAt);

        await expect(
          store.updateUser(loaded.id, userEdit(loaded, { name: "Stale" }), ACTOR)
        ).rejects.toMatchObject({ code: "STALE_RECORD", issues: [{ path: "updatedAt" }] });
        await expect(
          store.updateUser(loaded.id, userEdit(restored, { name: "Fresh" }), ACTOR)
        ).resolves.toMatchObject({ name: "Fresh", deletedAt: null });
      });
    });

    it("keeps a Trashed user's email, so a restore never meets a reused one", async () => {
      await withMigratedDb(async (db) => {
        const store = storeFor(db);
        const trashed = await store.createUser(newUser(), ACTOR);
        await store.deleteUser(trashed.id, ACTOR);

        await expect(
          store.createUser(newUser({ name: "Someone else" }), ACTOR)
        ).rejects.toMatchObject({ code: "CONFLICT", issues: [{ path: "email" }] });
        await expect(store.restoreUser(trashed.id, ACTOR)).resolves.toMatchObject({
          deletedAt: null
        });
      });
    });

    it("gives a Trashed user no session, no sign-in and no access, even to a session that outlived the delete", async () => {
      await withMigratedDb(async (db, client) => {
        const store = storeFor(db);
        const admin = await insertRole(client, "Admin");
        await client.exec(
          `insert into master.role_permissions (role_id, permission_key) values ('${admin}', 'master-users.view_any')`
        );
        const created = await store.createUser(newUser({ roleIds: [admin] }), {
          ...ACTOR,
          permissions: ["master-users.view_any"]
        });
        await expect(store.getPermissions(created.id)).resolves.toEqual(["master-users.view_any"]);

        await store.deleteUser(created.id, { ...ACTOR, permissions: ["master-users.view_any"] });
        // a session minted in the gap between the gate's read and the delete
        await client.exec(
          `insert into public.session (id, expires_at, token, created_at, updated_at, user_id)
            values ('late', now() + interval '1 day', 'late-token', now(), now(), '${created.id}')`
        );

        await expect(store.getSignInEligibility(created.id)).resolves.toMatchObject({
          deletedAt: expect.any(String)
        });
        await expect(store.getPermissions(created.id)).resolves.toEqual([]);
        await expect(store.getAccess(created.id)).resolves.toEqual({
          permissions: [],
          divisions: []
        });
      });
    });
  });
});
