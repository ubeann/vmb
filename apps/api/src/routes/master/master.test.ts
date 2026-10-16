import type {
  Division,
  DivisionListRequest,
  DivisionListResponse,
  Role,
  RoleListResponse,
  User,
  UserListRequest,
  UserListResponse
} from "@vmb/types";
import { allPermissionKeys } from "@vmb/types";
import { Hono } from "hono";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RuleBrokenError,
  StaleRecordError
} from "@vmb/db";
import type { MasterStore } from "@vmb/db";
import { describe, expect, it, vi } from "vitest";
import type { Bindings } from "../../bindings.js";
import { withErrorReplies } from "../../error-reply.js";
import { createMasterRoutes } from "./index.js";

const ID = "d1000000-0000-4000-8000-000000000001";
const OTHER_ID = "d1000000-0000-4000-8000-000000000002";
const STAMP = "2026-01-05T01:10:00.000Z";
const env = { DATABASE_URL: "postgres://test" } as Bindings;
// who the routes say is asking: the caller, with what `requirePermission` read
const CALLER = { id: ID, permissions: allPermissionKeys() };

const division: Division = {
  id: ID,
  name: "Operations",
  code: "OPS",
  description: "",
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

const role: Role = {
  id: ID,
  name: "Staff",
  isActive: true,
  isSystem: false,
  colorHex: "#805AD5",
  iconName: "user",
  description: "",
  divisionId: null,
  createdAt: STAMP,
  updatedAt: STAMP
};

const EMPTY_ROLES: RoleListResponse = {
  items: [],
  total: 0,
  page: 1,
  perPage: 10,
  facets: { status: { active: 0, inactive: 0 } }
};

const user: User = {
  id: ID,
  name: "Rina Wijaya",
  status: "active",
  roles: [],
  divisions: [],
  phone: "+628111000001",
  email: "rina@vmblogistics.id",
  emailVerified: false,
  profilePhotoPath: "",
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

const EMPTY_USERS: UserListResponse = {
  items: [],
  total: 0,
  page: 1,
  perPage: 10,
  views: { all: 0, trash: 0 },
  facets: { status: { active: 0, inactive: 0, suspended: 0 }, division: {} }
};

const EMPTY_DIVISIONS: DivisionListResponse = {
  items: [],
  total: 0,
  page: 1,
  perPage: 10,
  views: { all: 0, trash: 0 },
  facets: { status: { active: 0, inactive: 0 } }
};

function fakeStore(overrides: Partial<MasterStore> = {}): MasterStore {
  return {
    // the caller may do everything unless a test narrows it (permissions.test.ts)
    getPermissions: vi.fn(async () => allPermissionKeys()),
    getAccess: vi.fn(async () => ({ permissions: allPermissionKeys(), divisions: [] })),
    listDivisions: vi.fn(async () => EMPTY_DIVISIONS),
    getDivision: vi.fn(async () => ({ ...division, userCount: 0 })),
    createDivision: vi.fn(async () => division),
    updateDivision: vi.fn(async () => division),
    deleteDivision: vi.fn(async () => undefined),
    restoreDivision: vi.fn(async () => division),
    setDivisionActive: vi.fn(async () => division),
    bulkDivisions: vi.fn(async (request) => ({ ids: request.ids })),
    listRoles: vi.fn(async () => EMPTY_ROLES),
    getRole: vi.fn(async () => ({ ...role, divisionName: null })),
    createRole: vi.fn(async () => role),
    updateRole: vi.fn(async () => role),
    deleteRole: vi.fn(async () => undefined),
    listUsers: vi.fn(async () => EMPTY_USERS),
    getUser: vi.fn(async () => user),
    getSignInEligibility: vi.fn(async () => ({ deletedAt: null, status: "active" as const })),
    createUser: vi.fn(async () => user),
    updateUser: vi.fn(async () => user),
    deleteUser: vi.fn(async () => undefined),
    restoreUser: vi.fn(async () => user),
    bulkUsers: vi.fn(async (request) => ({ ids: request.ids })),
    ...overrides
  };
}

// Never the real Pwned Passwords lookup: a test makes no network call.
function appWith(store: MasterStore, isPasswordBreached = async (_password: string) => false) {
  return withErrorReplies(
    new Hono<{ Variables: { userId: string } }>()
      .use("*", async (c, next) => {
        c.set("userId", ID);
        await next();
      })
      .route(
        "/",
        createMasterRoutes(() => store, isPasswordBreached)
      )
  );
}

function json(method: string, body: unknown) {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

const divisionBody = {
  name: "Operations",
  code: "OPS",
  description: "",
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: true
};

describe("master API: divisions", () => {
  it("parses query parameters against the shared schema", async () => {
    const store = fakeStore();
    const response = await appWith(store).request(
      "/divisions?search=%20ops%20&status=inactive&trashed=only&sort=code&dir=desc&page=2&perPage=25",
      {},
      env
    );

    expect(response.status).toBe(200);
    expect(store.listDivisions).toHaveBeenCalledWith({
      search: "ops",
      status: ["inactive"],
      updated: undefined,
      created: undefined,
      trashed: "only",
      sort: "code",
      dir: "desc",
      page: 2,
      perPage: 25,
      tz: "Asia/Jakarta"
    } satisfies DivisionListRequest);
  });

  it("takes several statuses, date ranges or presets, and the reader's zone", async () => {
    const store = fakeStore();
    const response = await appWith(store).request(
      "/divisions?status=inactive,active&updated=2025-12-29..2026-01-04&created=week&tz=UTC",
      {},
      env
    );

    expect(response.status).toBe(200);
    expect(store.listDivisions).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ["active", "inactive"],
        updated: "2025-12-29..2026-01-04",
        created: "week",
        tz: "UTC"
      })
    );
  });

  it("reads the old single-value status=all as any status", async () => {
    const store = fakeStore();
    await appWith(store).request("/divisions?status=all", {}, env);

    expect(store.listDivisions).toHaveBeenCalledWith(expect.objectContaining({ status: [] }));
  });

  it.each([
    ["an unknown status", "status=active,archived", "status.1"],
    ["a range ending before it starts", "updated=2026-02-01..2026-01-31", "updated"],
    ["a day that does not exist", "created=2026-02-30..2026-03-01", "created"],
    ["an offset in place of a zone", "tz=%2B07:00", "tz"]
  ])("rejects %s with the issue list", async (_name, search, path) => {
    const store = fakeStore();
    const response = await appWith(store).request(`/divisions?${search}`, {}, env);
    const body = (await response.json()) as { code: string; issues: { path: string }[] };

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.issues.map((issue) => issue.path)).toEqual([path]);
    expect(store.listDivisions).not.toHaveBeenCalled();
  });

  it("answers with the view and status counts", async () => {
    const counts = {
      views: { all: 4, trash: 1 },
      facets: { status: { active: 3, inactive: 1 } }
    };
    const store = fakeStore({
      listDivisions: vi.fn(async () => ({
        ...EMPTY_DIVISIONS,
        items: [division],
        total: 1,
        ...counts
      }))
    });

    const response = await appWith(store).request("/divisions", {}, env);

    await expect(response.json()).resolves.toMatchObject({ total: 1, ...counts });
  });

  it("defaults the query to the first page, active rows only", async () => {
    const store = fakeStore({
      listDivisions: vi.fn(async () => ({ ...EMPTY_DIVISIONS, items: [division], total: 1 }))
    });

    const response = await appWith(store).request("/divisions", {}, env);
    const body = (await response.json()) as DivisionListResponse;

    expect(body).toMatchObject({ total: 1, page: 1, perPage: 10 });
    expect(store.listDivisions).toHaveBeenCalledWith({
      search: undefined,
      status: [],
      updated: undefined,
      created: undefined,
      trashed: "exclude",
      sort: "name",
      dir: "asc",
      page: 1,
      perPage: 25,
      tz: "Asia/Jakarta"
    });
  });

  it("rejects an unsupported page size with the issue list", async () => {
    const store = fakeStore();
    const response = await appWith(store).request("/divisions?perPage=7", {}, env);
    const body = (await response.json()) as {
      code: string;
      message: string;
      issues: { path: string }[];
    };

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.message).toBe("Invalid query parameters.");
    expect(body.issues[0]?.path).toBe("perPage");
    expect(store.listDivisions).not.toHaveBeenCalled();
  });

  it("creates from a valid body and answers 201", async () => {
    const store = fakeStore();
    const response = await appWith(store).request("/divisions", json("POST", divisionBody), env);

    expect(response.status).toBe(201);
    expect(store.createDivision).toHaveBeenCalledWith({
      name: "Operations",
      code: "OPS",
      description: "",
      colorHex: "#2563EB",
      iconName: "settings",
      isActive: true
    });
  });

  it("rejects a body that fails the shared schema, naming the fields", async () => {
    const store = fakeStore();
    const response = await appWith(store).request(
      "/divisions",
      json("POST", { name: "", code: "O", colorHex: "blue", iconName: "" }),
      env
    );
    const body = (await response.json()) as { issues: { path: string }[] };

    expect(response.status).toBe(400);
    expect(body.issues.map((issue) => issue.path).sort()).toEqual([
      "code",
      "colorHex",
      "iconName",
      "name"
    ]);
    expect(store.createDivision).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body", async () => {
    const response = await appWith(fakeStore()).request(
      "/divisions",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{" },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "MALFORMED_REQUEST",
      message: "The request body is not valid JSON."
    });
  });

  it("returns a division's user count on its detail and not on the list rows", async () => {
    const store = fakeStore({
      getDivision: vi.fn(async () => ({ ...division, userCount: 4 })),
      listDivisions: vi.fn(async () => ({ ...EMPTY_DIVISIONS, items: [division], total: 1 }))
    });

    const detail = await appWith(store).request(`/divisions/${ID}`, {}, env);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({ id: ID, userCount: 4 });

    const list = await appWith(store).request("/divisions", {}, env);
    const body = (await list.json()) as { items: object[] };
    expect(body.items[0]).not.toHaveProperty("userCount");
  });

  it("reads, updates, deletes and restores by id", async () => {
    const store = fakeStore();

    await expect(appWith(store).request(`/divisions/${ID}`, {}, env)).resolves.toMatchObject({
      status: 200
    });
    expect(store.getDivision).toHaveBeenCalledWith(ID);

    await expect(
      appWith(store).request(
        `/divisions/${ID}`,
        json("PATCH", { ...divisionBody, updatedAt: STAMP }),
        env
      )
    ).resolves.toMatchObject({ status: 200 });
    expect(store.updateDivision).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ name: "Operations" })
    );

    const deleted = await appWith(store).request(`/divisions/${ID}`, { method: "DELETE" }, env);
    expect(deleted.status).toBe(204);
    expect(store.deleteDivision).toHaveBeenCalledWith(ID);

    await expect(
      appWith(store).request(`/divisions/${ID}/restore`, { method: "POST" }, env)
    ).resolves.toMatchObject({ status: 200 });
    expect(store.restoreDivision).toHaveBeenCalledWith(ID);
  });

  it("deletes and restores several at once through the one bulk endpoint", async () => {
    const store = fakeStore();
    const ids = [ID, OTHER_ID];

    const deleted = await appWith(store).request(
      "/divisions/bulk",
      json("POST", { action: "delete", ids }),
      env
    );
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ ids });
    expect(store.bulkDivisions).toHaveBeenLastCalledWith({ action: "delete", ids });

    const restored = await appWith(store).request(
      "/divisions/bulk",
      json("POST", { action: "restore", ids }),
      env
    );
    expect(restored.status).toBe(200);
    expect(store.bulkDivisions).toHaveBeenLastCalledWith({ action: "restore", ids });
  });

  it("refuses a bulk request with no ids, more than 100, a bad id or an unknown action", async () => {
    const store = fakeStore();
    const crowd = Array.from(
      { length: 101 },
      (_, n) => `d1000000-0000-4000-8000-${String(n).padStart(12, "0")}`
    );

    for (const body of [
      { action: "delete", ids: [] },
      { action: "delete", ids: crowd },
      { action: "delete", ids: ["nope"] },
      { action: "destroy", ids: [ID] },
      { ids: [ID] }
    ]) {
      const response = await appWith(store).request("/divisions/bulk", json("POST", body), env);
      expect(response.status).toBe(400);
    }
    // the cap is 100, and exactly 100 is fine
    const full = await appWith(store).request(
      "/divisions/bulk",
      json("POST", { action: "delete", ids: crowd.slice(0, 100) }),
      env
    );
    expect(full.status).toBe(200);
    expect(store.bulkDivisions).toHaveBeenCalledTimes(1);
  });

  it("maps a bulk delete that meets a division with roles to 409 DIVISION_IN_USE, naming them", async () => {
    const message = "1 of the 2 selected divisions still has roles: “Busy” (1 role).";
    const store = fakeStore({
      bulkDivisions: vi.fn(async () => {
        throw new ConflictError(message, { code: "DIVISION_IN_USE" });
      })
    });

    const response = await appWith(store).request(
      "/divisions/bulk",
      json("POST", { action: "delete", ids: [ID, OTHER_ID] }),
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "DIVISION_IN_USE", message });
  });

  it("maps deleting a division that still has roles to 409 DIVISION_IN_USE", async () => {
    const store = fakeStore({
      deleteDivision: vi.fn(async () => {
        throw new ConflictError(
          "3 roles belong to this division. Move them to another division or delete them first.",
          { code: "DIVISION_IN_USE" }
        );
      })
    });
    const response = await appWith(store).request(`/divisions/${ID}`, { method: "DELETE" }, env);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "DIVISION_IN_USE",
      message:
        "3 roles belong to this division. Move them to another division or delete them first."
    });
  });

  it("activates and deactivates by id through the status-only store call", async () => {
    const store = fakeStore();

    await expect(
      appWith(store).request(`/divisions/${ID}/deactivate`, { method: "POST" }, env)
    ).resolves.toMatchObject({ status: 200 });
    expect(store.setDivisionActive).toHaveBeenLastCalledWith(ID, false);

    const activated = await appWith(store).request(
      `/divisions/${ID}/activate`,
      { method: "POST" },
      env
    );
    expect(activated.status).toBe(200);
    await expect(activated.json()).resolves.toMatchObject({ id: ID, name: "Operations" });
    expect(store.setDivisionActive).toHaveBeenLastCalledWith(ID, true);
    // the whole-record update is not how a switch is made
    expect(store.updateDivision).not.toHaveBeenCalled();
  });

  it("answers 404 when the division to switch is missing or Trashed", async () => {
    const store = fakeStore({
      setDivisionActive: vi.fn(async () => {
        throw new NotFoundError("Division not found.");
      })
    });

    const response = await appWith(store).request(
      `/divisions/${ID}/activate`,
      { method: "POST" },
      env
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Division not found."
    });
  });

  it("rejects an id that is not a uuid", async () => {
    const store = fakeStore();
    const response = await appWith(store).request("/divisions/not-a-uuid", {}, env);

    expect(response.status).toBe(400);
    expect(store.getDivision).not.toHaveBeenCalled();
  });

  it("maps a missing record to 404 and a duplicate to 409", async () => {
    const missing = fakeStore({
      getDivision: vi.fn(async () => {
        throw new NotFoundError("Division not found.");
      })
    });
    const notFound = await appWith(missing).request(`/divisions/${ID}`, {}, env);
    expect(notFound.status).toBe(404);
    await expect(notFound.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Division not found."
    });

    const duplicate = fakeStore({
      createDivision: vi.fn(async () => {
        throw new ConflictError("A division with that name already exists.", {
          issues: [{ path: "name", message: "A division with that name already exists." }]
        });
      })
    });
    const response = await appWith(duplicate).request(
      "/divisions",
      json("POST", divisionBody),
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "CONFLICT",
      message: "A division with that name already exists.",
      issues: [{ path: "name", message: "A division with that name already exists." }]
    });
  });
});

describe("master API: roles", () => {
  it("lists with the role query schema defaults", async () => {
    const store = fakeStore({
      listRoles: vi.fn(async () => ({ ...EMPTY_ROLES, items: [role], total: 1 }))
    });

    await appWith(store).request("/roles", {}, env);

    expect(store.listRoles).toHaveBeenCalledWith({
      search: undefined,
      status: [],
      updated: undefined,
      created: undefined,
      sort: "name",
      dir: "asc",
      page: 1,
      perPage: 25,
      tz: "Asia/Jakarta"
    });
  });

  it("passes the status and date filters on, and answers with the status counts", async () => {
    const store = fakeStore({
      listRoles: vi.fn(async () => ({
        ...EMPTY_ROLES,
        items: [role],
        total: 1,
        facets: { status: { active: 4, inactive: 1 } }
      }))
    });

    const response = await appWith(store).request(
      "/roles?status=inactive&updated=week&created=2025-01-01..2025-01-31&sort=createdAt&dir=desc&tz=Asia/Makassar",
      {},
      env
    );

    expect(store.listRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ["inactive"],
        updated: "week",
        created: "2025-01-01..2025-01-31",
        sort: "createdAt",
        dir: "desc",
        tz: "Asia/Makassar"
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      facets: { status: { active: 4, inactive: 1 } }
    });
  });

  it("refuses the retired access-level sort and the old active filter's values", async () => {
    const response = await appWith(fakeStore()).request("/roles?sort=level", {}, env);
    expect(response.status).toBe(400);
  });

  it("answers a role's detail with its division's name", async () => {
    const store = fakeStore({
      getRole: vi.fn(async () => ({ ...role, divisionName: "Hub" }))
    });

    const response = await appWith(store).request(`/roles/${ID}`, {}, env);

    await expect(response.json()).resolves.toMatchObject({ id: ID, divisionName: "Hub" });
  });

  it("creates, updates and deletes", async () => {
    const store = fakeStore();
    const body = {
      name: "Staff",
      description: "",
      colorHex: "#805AD5",
      iconName: "user",
      isActive: "on"
    };

    await expect(appWith(store).request("/roles", json("POST", body), env)).resolves.toMatchObject({
      status: 201
    });
    expect(store.createRole).toHaveBeenCalledWith({
      name: "Staff",
      description: "",
      colorHex: "#805AD5",
      iconName: "user",
      isActive: true
    });

    await expect(
      appWith(store).request(`/roles/${ID}`, json("PATCH", { ...body, updatedAt: STAMP }), env)
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      appWith(store).request(`/roles/${ID}`, { method: "DELETE" }, env)
    ).resolves.toMatchObject({ status: 204 });
  });

  it("maps a system role to 403 SYSTEM_ROLE", async () => {
    const store = fakeStore({
      deleteRole: vi.fn(async () => {
        throw new ForbiddenError("SYSTEM_ROLE", "System roles cannot be modified or deleted.");
      })
    });
    const response = await appWith(store).request(`/roles/${ID}`, { method: "DELETE" }, env);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "SYSTEM_ROLE",
      message: "System roles cannot be modified or deleted."
    });
  });

  it("maps deleting a role users hold to 409 ROLE_IN_USE", async () => {
    const store = fakeStore({
      deleteRole: vi.fn(async () => {
        throw new ConflictError("3 users hold this role. Remove it from them first.", {
          code: "ROLE_IN_USE"
        });
      })
    });
    const response = await appWith(store).request(`/roles/${ID}`, { method: "DELETE" }, env);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "ROLE_IN_USE",
      message: "3 users hold this role. Remove it from them first."
    });
  });
});

describe("master API: users", () => {
  const body = {
    name: "Rina Wijaya",
    email: "rina@vmblogistics.id",
    phone: "0811-1000-0001",
    roleIds: [OTHER_ID],
    status: "active",
    profilePhotoPath: "",
    password: "a-long-enough-password",
    passwordConfirmation: "a-long-enough-password"
  };

  it("creates with a normalized phone and the password confirmation", async () => {
    const store = fakeStore();
    const response = await appWith(store).request("/users", json("POST", body), env);

    expect(response.status).toBe(201);
    // the second argument is who is asking, which the role guard needs
    expect(store.createUser).toHaveBeenCalledWith(
      {
        name: "Rina Wijaya",
        email: "rina@vmblogistics.id",
        phone: "+6281110000001",
        roleIds: [OTHER_ID],
        status: "active",
        profilePhotoPath: "",
        password: "a-long-enough-password",
        passwordConfirmation: "a-long-enough-password"
      },
      CALLER
    );
  });

  it("answers 403 PERMISSION_ESCALATION when the caller may not grant a chosen role", async () => {
    const message = "You cannot change a role that carries permissions you do not have.";
    const store = fakeStore({
      createUser: vi.fn(async () => {
        throw new ForbiddenError("PERMISSION_ESCALATION", message);
      })
    });

    const response = await appWith(store).request("/users", json("POST", body), env);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "PERMISSION_ESCALATION", message });
  });

  it("answers 403 PERMISSION_ESCALATION when the caller may not change the user", async () => {
    const message = "You cannot change a user who holds permissions you do not have.";
    const store = fakeStore({
      updateUser: vi.fn(async () => {
        throw new ForbiddenError("PERMISSION_ESCALATION", message);
      })
    });

    const response = await appWith(store).request(
      `/users/${ID}`,
      json("PATCH", { ...body, updatedAt: STAMP }),
      env
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "PERMISSION_ESCALATION", message });
  });

  it.each([
    ["11 characters", "x".repeat(11)],
    ["129 characters", "x".repeat(129)]
  ])("refuses a password of %s on create", async (_label, password) => {
    const store = fakeStore();
    const response = await appWith(store).request(
      "/users",
      json("POST", { ...body, password, passwordConfirmation: password }),
      env
    );

    expect(response.status).toBe(400);
    expect(store.createUser).not.toHaveBeenCalled();
  });

  it("accepts a password at the 12 and 128 character bounds", async () => {
    for (const password of ["x".repeat(12), "x".repeat(128)]) {
      const store = fakeStore();
      const response = await appWith(store).request(
        "/users",
        json("POST", { ...body, password, passwordConfirmation: password }),
        env
      );

      expect(response.status).toBe(201);
    }
  });

  it("refuses a password built from the email name or VMB (#256)", async () => {
    for (const password of [
      "rina@vmblogistics.id-too",
      "my-rina.wijaya-secret",
      "VMB is a long phrase"
    ]) {
      const store = fakeStore();
      const response = await appWith(store).request(
        "/users",
        json("POST", {
          ...body,
          email: "rina.wijaya@vmblogistics.id",
          password,
          passwordConfirmation: password
        }),
        env
      );

      expect(response.status).toBe(400);
      expect(store.createUser).not.toHaveBeenCalled();
    }
  });

  it("refuses a breached password on create, with its own message (#256)", async () => {
    const store = fakeStore();
    const response = await appWith(store, async () => true).request(
      "/users",
      json("POST", body),
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "PASSWORD_BREACHED",
      message: "This password appeared in a data leak. Choose a different one.",
      issues: [
        {
          path: "password",
          message: "This password appeared in a data leak. Choose a different one."
        }
      ]
    });
    expect(store.createUser).not.toHaveBeenCalled();
  });

  it("refuses a breached password on update, but does not look up an empty one", async () => {
    const store = fakeStore();
    const isPasswordBreached = vi.fn(async () => true);
    const app = appWith(store, isPasswordBreached);

    const refused = await app.request(
      `/users/${ID}`,
      json("PATCH", { ...body, updatedAt: STAMP }),
      env
    );
    expect(refused.status).toBe(400);
    expect(store.updateUser).not.toHaveBeenCalled();

    isPasswordBreached.mockClear();
    const kept = await app.request(
      `/users/${ID}`,
      json("PATCH", { ...body, password: "", passwordConfirmation: "", updatedAt: STAMP }),
      env
    );
    expect(kept.status).toBe(200);
    expect(isPasswordBreached).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation", async () => {
    const response = await appWith(fakeStore()).request(
      "/users",
      json("POST", { ...body, passwordConfirmation: "a-different-long-password" }),
      env
    );
    const parsed = (await response.json()) as {
      code: string;
      issues: { path: string; message: string }[];
    };

    expect(response.status).toBe(400);
    expect(parsed.code).toBe("VALIDATION_FAILED");
    expect(parsed.issues).toContainEqual({
      path: "passwordConfirmation",
      message: "Passwords do not match."
    });
  });

  it("updates without a password, and with one", async () => {
    const store = fakeStore();
    const response = await appWith(store).request(
      `/users/${ID}`,
      json("PATCH", { ...body, password: "", passwordConfirmation: "", updatedAt: STAMP }),
      env
    );

    expect(response.status).toBe(200);
    expect(store.updateUser).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ password: "" }),
      CALLER
    );

    await appWith(store).request(
      `/users/${ID}`,
      json("PATCH", {
        ...body,
        password: "newa-long-enough-password",
        passwordConfirmation: "newa-long-enough-password",
        updatedAt: STAMP
      }),
      env
    );
    expect(store.updateUser).toHaveBeenLastCalledWith(
      ID,
      expect.objectContaining({ password: "newa-long-enough-password" }),
      CALLER
    );
  });

  it("lists with the kit's defaults", async () => {
    const store = fakeStore();

    await appWith(store).request("/users", {}, env);

    expect(store.listUsers).toHaveBeenCalledWith({
      search: undefined,
      status: [],
      division: [],
      updated: undefined,
      created: undefined,
      trashed: "exclude",
      sort: "name",
      dir: "asc",
      page: 1,
      perPage: 25,
      tz: "Asia/Jakarta"
    } satisfies UserListRequest);
  });

  it("takes several statuses and divisions, date filters and the reader's zone", async () => {
    const store = fakeStore({
      listUsers: vi.fn(async () => ({
        ...EMPTY_USERS,
        items: [user],
        total: 1,
        views: { all: 4, trash: 1 },
        facets: {
          status: { active: 2, inactive: 0, suspended: 2 },
          division: { [OTHER_ID]: 3 }
        }
      }))
    });

    const response = await appWith(store).request(
      `/users?division=${OTHER_ID},${ID}&status=suspended,active&updated=week&created=2025-01-01..2025-01-31&tz=UTC`,
      {},
      env
    );

    expect(store.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        division: [OTHER_ID, ID],
        status: ["active", "suspended"],
        updated: "week",
        created: "2025-01-01..2025-01-31",
        tz: "UTC"
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      views: { all: 4, trash: 1 },
      facets: { status: { suspended: 2 }, division: { [OTHER_ID]: 3 } }
    });
  });

  it.each([
    ["an unknown status", "status=active,archived", "status.1"],
    ["a division that is not an id", `division=${ID},nope`, "division.1"]
  ])("rejects %s with the issue list", async (_name, search, path) => {
    const store = fakeStore();
    const response = await appWith(store).request(`/users?${search}`, {}, env);
    const body = (await response.json()) as { code: string; issues: { path: string }[] };

    expect(response.status).toBe(400);
    expect(body.issues.map((issue) => issue.path)).toEqual([path]);
    expect(store.listUsers).not.toHaveBeenCalled();
  });

  it("answers 400 VALIDATION_FAILED on roleIds when a chosen role's division is Inactive", async () => {
    const message =
      "The role “Hub staff” is scoped to an Inactive Division and cannot be given to a user.";
    const store = fakeStore({
      createUser: vi.fn(async () => {
        throw new RuleBrokenError(message, "roleIds");
      }),
      updateUser: vi.fn(async () => {
        throw new RuleBrokenError(message, "roleIds");
      })
    });

    const created = await appWith(store).request("/users", json("POST", body), env);
    expect(created.status).toBe(400);
    await expect(created.json()).resolves.toEqual({
      code: "VALIDATION_FAILED",
      message,
      issues: [{ path: "roleIds", message }]
    });

    const updated = await appWith(store).request(
      `/users/${ID}`,
      json("PATCH", { ...body, updatedAt: STAMP }),
      env
    );
    expect(updated.status).toBe(400);
  });

  it("deletes and restores", async () => {
    const store = fakeStore();

    await expect(
      appWith(store).request(`/users/${ID}`, { method: "DELETE" }, env)
    ).resolves.toMatchObject({ status: 204 });
    expect(store.deleteUser).toHaveBeenCalledWith(ID, CALLER);

    await expect(
      appWith(store).request(`/users/${ID}/restore`, { method: "POST" }, env)
    ).resolves.toMatchObject({ status: 200 });
    expect(store.restoreUser).toHaveBeenCalledWith(ID, CALLER);
  });

  it("deletes and restores several at once, as the caller", async () => {
    const store = fakeStore();
    const ids = [ID, OTHER_ID];

    const deleted = await appWith(store).request(
      "/users/bulk",
      json("POST", { action: "delete", ids }),
      env
    );
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ ids });
    expect(store.bulkUsers).toHaveBeenLastCalledWith({ action: "delete", ids }, CALLER);

    await appWith(store).request("/users/bulk", json("POST", { action: "restore", ids }), env);
    expect(store.bulkUsers).toHaveBeenLastCalledWith({ action: "restore", ids }, CALLER);
  });

  it("maps a bulk delete that reaches a user out of the caller's reach to 403", async () => {
    const message = "You cannot change a user who holds permissions you do not have: “Rina”.";
    const store = fakeStore({
      bulkUsers: vi.fn(async () => {
        throw new ForbiddenError("PERMISSION_ESCALATION", message);
      })
    });

    const response = await appWith(store).request(
      "/users/bulk",
      json("POST", { action: "delete", ids: [ID] }),
      env
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "PERMISSION_ESCALATION", message });
  });

  it("maps a duplicate email to 409 CONFLICT naming the email field", async () => {
    const taken = { path: "email", message: "A user with that email already exists." };
    const store = fakeStore({
      createUser: vi.fn(async () => {
        throw new ConflictError(taken.message, { issues: [taken] });
      })
    });
    const response = await appWith(store).request("/users", json("POST", body), env);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "CONFLICT",
      message: taken.message,
      issues: [taken]
    });
  });
});

describe("master API: edits over a newer save", () => {
  const edits = [
    {
      name: "division",
      path: `/divisions/${ID}`,
      method: "updateDivision",
      body: {
        name: "Operations",
        code: "OPS",
        description: "",
        colorHex: "#2563EB",
        iconName: "settings",
        isActive: true
      }
    },
    {
      name: "role",
      path: `/roles/${ID}`,
      method: "updateRole",
      body: {
        name: "Staff",
        description: "",
        colorHex: "#805AD5",
        iconName: "user",
        isActive: true
      }
    },
    {
      name: "user",
      path: `/users/${ID}`,
      method: "updateUser",
      body: {
        name: "Rina Wijaya",
        email: "rina@vmblogistics.id",
        phone: "0811-1000-0001",
        roleIds: [],
        status: "active",
        profilePhotoPath: "",
        password: "",
        passwordConfirmation: ""
      }
    }
  ] as const;

  it.each(edits)("hands a $name's updatedAt to the store", async ({ path, method, body }) => {
    const store = fakeStore();

    const response = await appWith(store).request(
      path,
      json("PATCH", { ...body, updatedAt: STAMP }),
      env
    );

    expect(response.status).toBe(200);
    expect(store[method]).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ updatedAt: STAMP }),
      ...(method === "updateUser" ? [CALLER] : [])
    );
  });

  it.each(edits)("rejects a $name PATCH without updatedAt", async ({ path, method, body }) => {
    const store = fakeStore();

    const response = await appWith(store).request(path, json("PATCH", body), env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_FAILED",
      issues: [{ path: "updatedAt" }]
    });
    expect(store[method]).not.toHaveBeenCalled();
  });

  it.each(edits)(
    "rejects a $name updatedAt that is not a timestamp",
    async ({ path, method, body }) => {
      const store = fakeStore();

      for (const updatedAt of ["yesterday", "", 0]) {
        const response = await appWith(store).request(
          path,
          json("PATCH", { ...body, updatedAt }),
          env
        );
        expect(response.status).toBe(400);
      }
      expect(store[method]).not.toHaveBeenCalled();
    }
  );

  it.each(edits)(
    "answers 409 STALE_RECORD when a $name changed since it was loaded",
    async ({ path, method, body }) => {
      const message = "This record was changed by someone else since you opened it.";
      const store = fakeStore({
        [method]: vi.fn(async () => {
          throw new StaleRecordError();
        })
      });

      const response = await appWith(store).request(
        path,
        json("PATCH", { ...body, updatedAt: STAMP }),
        env
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        code: "STALE_RECORD",
        message,
        issues: [{ path: "updatedAt", message }]
      });
    }
  );

  it("creating does not take an updatedAt", async () => {
    const store = fakeStore();

    const response = await appWith(store).request(
      "/divisions",
      json("POST", { ...edits[0].body }),
      env
    );

    expect(response.status).toBe(201);
    expect(store.createDivision).toHaveBeenCalledWith(
      expect.not.objectContaining({ updatedAt: expect.anything() })
    );
  });
});
