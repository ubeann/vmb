import type {
  Division,
  DivisionListQuery,
  DivisionListResponse,
  Role,
  RoleListResponse,
  User,
  UserListResponse
} from "@vmb/types";
import { allPermissionKeys } from "@vmb/types";
import { Hono } from "hono";
import { ConflictError, ForbiddenError, NotFoundError } from "@vmb/db";
import type { MasterStore } from "@vmb/db";
import { describe, expect, it, vi } from "vitest";
import type { Bindings } from "../../bindings.js";
import { withErrorReplies } from "../../error-reply.js";
import { createMasterRoutes } from "./index.js";

const ID = "d1000000-0000-4000-8000-000000000001";
const OTHER_ID = "d1000000-0000-4000-8000-000000000002";
const STAMP = "2026-01-05T01:10:00.000Z";
const env = { DATABASE_URL: "postgres://test" } as Bindings;

const division: Division = {
  id: ID,
  name: "Operations",
  code: "OPS",
  description: "",
  colorHex: "#2563EB",
  iconName: "heroicon-o-cog-6-tooth",
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
  iconName: "heroicon-o-user",
  description: "",
  divisionId: null,
  createdAt: STAMP,
  updatedAt: STAMP
};

const user: User = {
  id: ID,
  name: "Rina Wijaya",
  status: "active",
  roles: [],
  phone: "+628111000001",
  email: "rina@vmblogistics.id",
  emailVerified: false,
  profilePhotoPath: "",
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

function fakeStore(overrides: Partial<MasterStore> = {}): MasterStore {
  return {
    // the caller may do everything unless a test narrows it (permissions.test.ts)
    getAccess: vi.fn(async () => ({ permissions: allPermissionKeys(), divisions: [] })),
    listDivisions: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 10 })),
    getDivision: vi.fn(async () => division),
    createDivision: vi.fn(async () => division),
    updateDivision: vi.fn(async () => division),
    deleteDivision: vi.fn(async () => undefined),
    restoreDivision: vi.fn(async () => division),
    listRoles: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 10 })),
    getRole: vi.fn(async () => role),
    createRole: vi.fn(async () => role),
    updateRole: vi.fn(async () => role),
    deleteRole: vi.fn(async () => undefined),
    listUsers: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 10 })),
    getUser: vi.fn(async () => user),
    getSignInEligibility: vi.fn(async () => ({ deletedAt: null, status: "active" as const })),
    createUser: vi.fn(async () => user),
    updateUser: vi.fn(async () => user),
    deleteUser: vi.fn(async () => undefined),
    restoreUser: vi.fn(async () => user),
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
  iconName: "heroicon-o-cog-6-tooth",
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
      status: "inactive",
      trashed: "only",
      sort: "code",
      dir: "desc",
      page: 2,
      perPage: 25
    } satisfies DivisionListQuery);
  });

  it("defaults the query to the first page, active rows only", async () => {
    const store = fakeStore({
      listDivisions: vi.fn(
        async () => ({ items: [division], total: 1, page: 1, perPage: 10 }) as DivisionListResponse
      )
    });

    const response = await appWith(store).request("/divisions", {}, env);
    const body = (await response.json()) as DivisionListResponse;

    expect(body).toMatchObject({ total: 1, page: 1, perPage: 10 });
    expect(store.listDivisions).toHaveBeenCalledWith({
      search: undefined,
      status: "all",
      trashed: "exclude",
      sort: "name",
      dir: "asc",
      page: 1,
      perPage: 25
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
      iconName: "heroicon-o-cog-6-tooth",
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

  it("reads, updates, deletes and restores by id", async () => {
    const store = fakeStore();

    await expect(appWith(store).request(`/divisions/${ID}`, {}, env)).resolves.toMatchObject({
      status: 200
    });
    expect(store.getDivision).toHaveBeenCalledWith(ID);

    await expect(
      appWith(store).request(`/divisions/${ID}`, json("PATCH", divisionBody), env)
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
      listRoles: vi.fn(
        async () => ({ items: [role], total: 1, page: 1, perPage: 10 }) as RoleListResponse
      )
    });

    await appWith(store).request("/roles", {}, env);

    expect(store.listRoles).toHaveBeenCalledWith({
      search: undefined,
      active: "all",
      sort: "name",
      dir: "asc",
      page: 1,
      perPage: 25
    });
  });

  it("creates, updates and deletes", async () => {
    const store = fakeStore();
    const body = {
      name: "Staff",
      description: "",
      colorHex: "#805AD5",
      iconName: "heroicon-o-user",
      isActive: "on"
    };

    await expect(appWith(store).request("/roles", json("POST", body), env)).resolves.toMatchObject({
      status: 201
    });
    expect(store.createRole).toHaveBeenCalledWith({
      name: "Staff",
      description: "",
      colorHex: "#805AD5",
      iconName: "heroicon-o-user",
      isActive: true
    });

    await expect(
      appWith(store).request(`/roles/${ID}`, json("PATCH", body), env)
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
      ID
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

    const response = await appWith(store).request(`/users/${ID}`, json("PATCH", body), env);

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

    const refused = await app.request(`/users/${ID}`, json("PATCH", body), env);
    expect(refused.status).toBe(400);
    expect(store.updateUser).not.toHaveBeenCalled();

    isPasswordBreached.mockClear();
    const kept = await app.request(
      `/users/${ID}`,
      json("PATCH", { ...body, password: "", passwordConfirmation: "" }),
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
      json("PATCH", { ...body, password: "", passwordConfirmation: "" }),
      env
    );

    expect(response.status).toBe(200);
    expect(store.updateUser).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ password: "" }),
      ID
    );

    await appWith(store).request(
      `/users/${ID}`,
      json("PATCH", {
        ...body,
        password: "newa-long-enough-password",
        passwordConfirmation: "newa-long-enough-password"
      }),
      env
    );
    expect(store.updateUser).toHaveBeenLastCalledWith(
      ID,
      expect.objectContaining({ password: "newa-long-enough-password" }),
      ID
    );
  });

  it("lists with a division filter", async () => {
    const store = fakeStore({
      listUsers: vi.fn(
        async () => ({ items: [user], total: 1, page: 1, perPage: 10 }) as UserListResponse
      )
    });

    await appWith(store).request(`/users?divisionId=${OTHER_ID}&status=suspended`, {}, env);

    expect(store.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ divisionId: OTHER_ID, status: "suspended" })
    );
  });

  it("deletes and restores", async () => {
    const store = fakeStore();

    await expect(
      appWith(store).request(`/users/${ID}`, { method: "DELETE" }, env)
    ).resolves.toMatchObject({ status: 204 });
    expect(store.deleteUser).toHaveBeenCalledWith(ID, ID);

    await expect(
      appWith(store).request(`/users/${ID}/restore`, { method: "POST" }, env)
    ).resolves.toMatchObject({ status: 200 });
    expect(store.restoreUser).toHaveBeenCalledWith(ID, ID);
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
