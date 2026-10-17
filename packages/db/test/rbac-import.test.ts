import { allPermissionKeys } from "@vmb/types";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planRbac, roleCopyId, uuidv5 } from "../src/import/rbac.js";
import { importSnapshot, summarise } from "../src/import/run.js";
import { parseSnapshot } from "../src/import/snapshot.js";
import type { Report } from "../src/import/verify.js";
import type { SqlClient } from "../src/sql-client.js";
import { count, createDatabase, migrationsFolder, type TestDatabase } from "./harness.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const snapshotFile = path.join(testDir, "fixtures", "rbac-snapshot.sql");

const OPERATIONS = "d0000000-0000-4000-8000-000000000001";
const TRUCKING = "d0000000-0000-4000-8000-000000000002";
const FINANCE = "d0000000-0000-4000-8000-000000000003";
const ARCHIVE = "d0000000-0000-4000-8000-000000000005";
const SUPER_ADMIN = "c0000000-0000-4000-8000-000000000001";
const MANAGER_DIVISION = "c0000000-0000-4000-8000-000000000002";
const STAFF = "c0000000-0000-4000-8000-000000000003";
const MANAGER_FINANCE = "c0000000-0000-4000-8000-000000000004";
const ARCHIVIST = "c0000000-0000-4000-8000-000000000005";
const user = (n: number) => `b0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

type RoleRow = {
  id: string;
  name: string;
  division_id: string | null;
  color_hex: string;
  icon_name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

const rolesQuery = `select id, name, division_id, color_hex, icon_name, description, is_active, is_system,
                           to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as created_at,
                           to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as updated_at
                      from master.roles order by name`;
const grantsQuery =
  "select role_id, permission_key from master.role_permissions order by role_id, permission_key";
const assignmentsQuery =
  "select user_id, role_id, created_at::text from master.user_roles order by user_id, role_id";

describe("UUIDv5", () => {
  it("matches the RFC 4122 reference vector", () => {
    // the DNS namespace and www.example.com, as every implementation checks it
    expect(uuidv5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2"
    );
  });
});

describe("the RBAC transform", () => {
  let database: TestDatabase;
  let client: SqlClient;
  let report: Report;

  beforeAll(async () => {
    database = await createDatabase();
    client = database.client;
    report = await importSnapshot(client, snapshotFile, migrationsFolder);
  });

  afterAll(async () => {
    await database?.close();
  });

  const roles = () => client.query<RoleRow>(rolesQuery);
  const roleNamed = async (name: string) => (await roles()).find((role) => role.name === name);

  it("splits a role held in several divisions into one scoped copy per division", async () => {
    const manager = (await roles()).filter((role) => role.name.startsWith("Manager - "));
    const staff = (await roles()).filter((role) => role.name.startsWith("Staff - "));

    // the rename table turns Manager Division into Manager; Staff splits as it is
    expect(manager.map((role) => [role.name, role.division_id, role.id])).toEqual([
      ["Manager - Operations", OPERATIONS, roleCopyId(MANAGER_DIVISION, OPERATIONS)],
      ["Manager - Trucking", TRUCKING, roleCopyId(MANAGER_DIVISION, TRUCKING)]
    ]);
    expect(staff.map((role) => [role.name, role.division_id, role.id])).toEqual([
      ["Staff - Operations", OPERATIONS, roleCopyId(STAFF, OPERATIONS)],
      ["Staff - Trucking", TRUCKING, roleCopyId(STAFF, TRUCKING)]
    ]);
    expect((await roles()).map((role) => role.id)).not.toContain(MANAGER_DIVISION);
  });

  it("gives a copy every field of its legacy role, with a Lucide icon", async () => {
    expect(await roleNamed("Manager - Trucking")).toEqual({
      id: roleCopyId(MANAGER_DIVISION, TRUCKING),
      name: "Manager - Trucking",
      division_id: TRUCKING,
      color_hex: "#123456",
      icon_name: "banknote",
      description: "Leads a division",
      is_active: true,
      is_system: false,
      // the snapshot's Jakarta wall-clock, as the instant it named
      created_at: "2025-01-02 01:00:00",
      updated_at: "2025-03-04 02:30:00"
    });
  });

  it("keeps the id and name of a role held in one division, and scopes it there", async () => {
    expect(await roleNamed("Manager Finance")).toMatchObject({
      id: MANAGER_FINANCE,
      division_id: FINANCE,
      is_active: false
    });
  });

  it("keeps a system role unscoped, under its id", async () => {
    expect(await roleNamed("Super Admin")).toMatchObject({
      id: SUPER_ADMIN,
      division_id: null,
      is_system: true,
      icon_name: "shield-check"
    });
  });

  it("carries a role nobody holds unscoped, under its id, and warns", async () => {
    expect(await roleNamed("Auditor")).toMatchObject({
      id: "c0000000-0000-4000-8000-000000000007",
      division_id: null,
      icon_name: "scale"
    });
    expect(report.warnings).toContainEqual({
      level: "warning",
      code: "role-scope",
      message:
        "role Auditor (c0000000-0000-4000-8000-000000000007) is held in no division, so it is carried unscoped and operates in every division; scope it on the Roles screen if it should not"
    });
  });

  it("carries a role scoped to a Trashed division as it is", async () => {
    expect(await roleNamed("Archivist")).toMatchObject({ id: ARCHIVIST, division_id: ARCHIVE });
  });

  it("falls back to the default colour for one that is not #RRGGBB, and warns", async () => {
    expect((await roleNamed("Manager Finance"))?.color_hex).toBe("#000000");
    expect(report.warnings).toContainEqual({
      level: "warning",
      code: "color-hex",
      message: `role Manager Finance (${MANAGER_FINANCE}): colour "red" is not #RRGGBB, so it takes the column default`
    });
  });

  it("names a legacy icon with no counterpart through the existing warning", () => {
    expect(report.warnings).toContainEqual({
      level: "warning",
      code: "icon-name",
      message: "master.roles: 1 row(s) hold an icon outside the catalogue: heroicon-o-arrow-left"
    });
  });

  it("refuses a second role whose name differs only by case, naming both", async () => {
    expect(report.errors).toContainEqual({
      level: "error",
      code: "role-name",
      message: `role STAFF (c0000000-0000-4000-8000-000000000006) differs from Staff (${STAFF}) only by case, so it is not carried`
    });
    expect((await roles()).map((role) => role.name)).not.toContain("STAFF");
  });

  it("grants Super Admin every catalogue key, ignoring its legacy grants", async () => {
    const keys = await client.query<{ permission_key: string }>(
      `select permission_key from master.role_permissions where role_id = '${SUPER_ADMIN}'
        order by permission_key`
    );
    expect(keys.map((row) => row.permission_key)).toEqual([...allPermissionKeys()].sort());

    // the rbac.test.ts assertion, on an imported database
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

  it("carries a legacy grant name for name, to each copy, inventing no key", async () => {
    const grants = await client.query<{ role_id: string; permission_key: string }>(
      `select role_id, permission_key from master.role_permissions
        where role_id <> '${SUPER_ADMIN}' order by role_id, permission_key`
    );
    const expected = [
      [roleCopyId(MANAGER_DIVISION, OPERATIONS), "master-divisions.manager"],
      [roleCopyId(MANAGER_DIVISION, OPERATIONS), "master-users.view_any"],
      [roleCopyId(MANAGER_DIVISION, TRUCKING), "master-divisions.manager"],
      [roleCopyId(MANAGER_DIVISION, TRUCKING), "master-users.view_any"],
      [roleCopyId(STAFF, OPERATIONS), "master-users.view_any"],
      [roleCopyId(STAFF, TRUCKING), "master-users.view_any"],
      [MANAGER_FINANCE, "master-divisions.manager"],
      [ARCHIVIST, "master-users.view_any"]
    ].sort((a, b) => `${a[0]}${a[1]}`.localeCompare(`${b[0]}${b[1]}`));

    expect(grants.map((row) => [row.role_id, row.permission_key])).toEqual(expected);
  });

  it("warns once per legacy resource whose permissions have no catalogue key", () => {
    expect(report.warnings.filter((finding) => finding.code === "unmapped-permission")).toEqual([
      {
        level: "warning",
        code: "unmapped-permission",
        message: "trucking-orders: view_any, create have no catalogue key and are not carried"
      },
      {
        level: "warning",
        code: "unmapped-permission",
        message: "warehouse-items: view has no catalogue key and is not carried"
      }
    ]);
  });

  it("assigns each holder the carried role or the copy for their division", async () => {
    const assignments = await client.query<{ user_id: string; role_id: string }>(
      "select user_id, role_id from master.user_roles order by user_id"
    );
    expect(assignments.map((row) => [row.user_id, row.role_id])).toEqual([
      // Super Admin's holder sits in Developer; the division is dropped
      [user(1), SUPER_ADMIN],
      [user(2), roleCopyId(MANAGER_DIVISION, OPERATIONS)],
      [user(3), roleCopyId(MANAGER_DIVISION, TRUCKING)],
      [user(4), roleCopyId(STAFF, OPERATIONS)],
      [user(5), roleCopyId(STAFF, TRUCKING)],
      [user(6), MANAGER_FINANCE],
      [user(11), ARCHIVIST]
    ]);
  });

  it("reports a holder with no division once, and assigns nothing", () => {
    const floating = [...report.errors].filter((finding) => finding.message.includes(user(7)));
    expect(floating).toEqual([
      {
        level: "error",
        code: "user-division",
        message: `user Floating Staff (${user(7)}) holds role Staff (${STAFF}) but has no division, so nothing is assigned`
      }
    ]);
  });

  it("reports a live user left with no role, but not a Trashed or Suspended one", () => {
    expect(report.errors.filter((finding) => finding.code === "role-less-user")).toEqual([
      {
        level: "error",
        code: "role-less-user",
        message: `user Roleless User (${user(8)}) is live but holds no role`
      }
    ]);
  });

  it("reports each direct permission grant", () => {
    expect(report.errors.filter((finding) => finding.code === "direct-permission")).toEqual([
      {
        level: "error",
        code: "direct-permission",
        message: `user Ops Staff (${user(4)}) is granted warehouse-items.view directly, which has no counterpart`
      }
    ]);
  });

  it("raises nothing it was not asked to", () => {
    expect(report.errors.map((finding) => finding.code).sort()).toEqual([
      "direct-permission",
      "role-less-user",
      "role-name",
      "user-division"
    ]);
    expect(report.warnings.map((finding) => finding.code).sort()).toEqual([
      "color-hex",
      "icon-name",
      "role-scope",
      "unmapped-permission",
      "unmapped-permission"
    ]);
  });

  it("reports what it carried in an rbac section, and the CLI prints it", () => {
    expect(report.rbac).toEqual({
      rolesCarried: 8,
      rolesSplit: 2,
      grants: allPermissionKeys().length + 8,
      assignments: 7,
      unmappedPermissions: 3
    });
    expect(summarise(report)).toContain(
      `rbac: 8 role(s) carried (2 split), ${allPermissionKeys().length + 8} grant(s), 7 assignment(s), 3 unmapped permission(s)`
    );
  });

  it("lands identical roles, grants and assignments when re-run", async () => {
    const before = await Promise.all([
      roles(),
      client.query(grantsQuery),
      client.query(assignmentsQuery)
    ]);

    const second = await importSnapshot(client, snapshotFile, migrationsFolder);

    expect(second.rbac).toEqual(report.rbac);
    expect(
      await Promise.all([roles(), client.query(grantsQuery), client.query(assignmentsQuery)])
    ).toEqual(before);
  });
});

describe("the RBAC plan", () => {
  const snapshot = (...blocks: string[][]) =>
    parseSnapshot(blocks.map((block) => [...block, "\\."].join("\n")).join("\n"));
  const divisions = ["COPY master.divisions (id, name) FROM stdin;", `${OPERATIONS}\tOperations`];

  it("reports a snapshot with no Super Admin role", () => {
    const plan = planRbac(
      snapshot(divisions, ["COPY master.roles (uuid, name, is_system) FROM stdin;"])
    );
    expect(plan.findings).toContainEqual({
      level: "error",
      code: "super-admin",
      message: "the snapshot has no system role named Super Admin, so nobody holds every permission"
    });
  });

  it("keeps the base name when no rename applies, and splits mechanically", () => {
    const plan = planRbac(
      snapshot(
        [
          "COPY master.divisions (id, name) FROM stdin;",
          `${OPERATIONS}\tOperations`,
          `${TRUCKING}\tTrucking`
        ],
        ["COPY master.users (id, name, status, division_id) FROM stdin;"]
          .concat([`${user(1)}\tA\tactive\t${OPERATIONS}`, `${user(2)}\tB\tactive\t${TRUCKING}`])
          .concat([`${user(3)}\tC\tactive\t${OPERATIONS}`]),
        [
          "COPY master.roles (uuid, name, is_system) FROM stdin;",
          `${SUPER_ADMIN}\tSuper Admin\tt`,
          `${STAFF}\tDriver Lead\tf`
        ],
        [
          "COPY spatie.model_has_roles (role_uuid, model_type, model_id) FROM stdin;",
          `${STAFF}\tApp\\\\Models\\\\Master\\\\User\t${user(1)}`,
          `${STAFF}\tApp\\\\Models\\\\Master\\\\User\t${user(2)}`,
          `${SUPER_ADMIN}\tApp\\\\Models\\\\Master\\\\User\t${user(3)}`
        ]
      )
    );
    expect(plan.roles.map((role) => role.name)).toEqual([
      "Super Admin",
      "Driver Lead - Operations",
      "Driver Lead - Trucking"
    ]);
    expect(plan.findings).toEqual([]);
  });
});
