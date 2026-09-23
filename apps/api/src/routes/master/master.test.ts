import type {
  Division,
  DivisionListQuery,
  DivisionListResponse,
  Role,
  RoleListResponse,
  User,
  UserListResponse
} from "@vmb/types";
import { MasterConflictError, MasterNotFoundError, MasterSystemRoleError } from "@vmb/db";
import type { MasterStore } from "@vmb/db";
import { describe, expect, it, vi } from "vitest";
import type { Bindings } from "../../bindings.js";
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
  guardName: "web",
  level: 0,
  isActive: true,
  isSystem: false,
  colorHex: "#805AD5",
  iconName: "heroicon-o-user",
  description: "",
  metadata: null,
  createdAt: STAMP,
  updatedAt: STAMP
};

const user: User = {
  id: ID,
  name: "Rina Wijaya",
  status: "active",
  divisionId: OTHER_ID,
  phone: "+628111000001",
  email: "rina@vmblogistics.id",
  emailVerifiedAt: null,
  profilePhotoPath: "",
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

function fakeStore(overrides: Partial<MasterStore> = {}): MasterStore {
  return {
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
    getUserStatus: vi.fn(async () => ({ deletedAt: null })),
    createUser: vi.fn(async () => user),
    updateUser: vi.fn(async () => user),
    deleteUser: vi.fn(async () => undefined),
    restoreUser: vi.fn(async () => user),
    ...overrides
  };
}

function appWith(store: MasterStore) {
  return createMasterRoutes(() => store);
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
      perPage: 10
    });
  });

  it("rejects an unsupported page size with the issue list", async () => {
    const store = fakeStore();
    const response = await appWith(store).request("/divisions?perPage=7", {}, env);
    const body = (await response.json()) as { error: string; issues: { path: string }[] };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid query parameters.");
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
        throw new MasterNotFoundError("Division not found.");
      })
    });
    await expect(appWith(missing).request(`/divisions/${ID}`, {}, env)).resolves.toMatchObject({
      status: 404
    });

    const duplicate = fakeStore({
      createDivision: vi.fn(async () => {
        throw new MasterConflictError("A division with that name already exists.");
      })
    });
    const response = await appWith(duplicate).request(
      "/divisions",
      json("POST", divisionBody),
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "A division with that name already exists."
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
      level: "all",
      active: "all",
      sort: "level",
      dir: "desc",
      page: 1,
      perPage: 10
    });
  });

  it("creates, updates and deletes", async () => {
    const store = fakeStore();
    const body = {
      name: "Staff",
      level: "2",
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
      level: 2,
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

  it("maps a system role to 403", async () => {
    const store = fakeStore({
      deleteRole: vi.fn(async () => {
        throw new MasterSystemRoleError();
      })
    });
    const response = await appWith(store).request(`/roles/${ID}`, { method: "DELETE" }, env);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "System roles cannot be modified or deleted."
    });
  });
});

describe("master API: users", () => {
  const body = {
    name: "Rina Wijaya",
    email: "rina@vmblogistics.id",
    phone: "0811-1000-0001",
    divisionId: OTHER_ID,
    status: "active",
    profilePhotoPath: "",
    password: "password123",
    passwordConfirmation: "password123"
  };

  it("creates with a normalized phone and the password confirmation", async () => {
    const store = fakeStore();
    const response = await appWith(store).request("/users", json("POST", body), env);

    expect(response.status).toBe(201);
    expect(store.createUser).toHaveBeenCalledWith({
      name: "Rina Wijaya",
      email: "rina@vmblogistics.id",
      phone: "+6281110000001",
      divisionId: OTHER_ID,
      status: "active",
      profilePhotoPath: "",
      password: "password123",
      passwordConfirmation: "password123"
    });
  });

  it("requires a password of at least 8 characters on create", async () => {
    const store = fakeStore();
    const response = await appWith(store).request(
      "/users",
      json("POST", { ...body, password: "short", passwordConfirmation: "short" }),
      env
    );

    expect(response.status).toBe(400);
    expect(store.createUser).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation", async () => {
    const response = await appWith(fakeStore()).request(
      "/users",
      json("POST", { ...body, passwordConfirmation: "different123" }),
      env
    );
    const parsed = (await response.json()) as { issues: { path: string; message: string }[] };

    expect(response.status).toBe(400);
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
    expect(store.updateUser).toHaveBeenCalledWith(ID, expect.objectContaining({ password: "" }));

    await appWith(store).request(
      `/users/${ID}`,
      json("PATCH", {
        ...body,
        password: "newpassword123",
        passwordConfirmation: "newpassword123"
      }),
      env
    );
    expect(store.updateUser).toHaveBeenLastCalledWith(
      ID,
      expect.objectContaining({ password: "newpassword123" })
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
    expect(store.deleteUser).toHaveBeenCalledWith(ID);

    await expect(
      appWith(store).request(`/users/${ID}/restore`, { method: "POST" }, env)
    ).resolves.toMatchObject({ status: 200 });
    expect(store.restoreUser).toHaveBeenCalledWith(ID);
  });

  it("maps a duplicate email to 409", async () => {
    const store = fakeStore({
      createUser: vi.fn(async () => {
        throw new MasterConflictError("A user with that email already exists.");
      })
    });
    const response = await appWith(store).request("/users", json("POST", body), env);

    expect(response.status).toBe(409);
  });
});
