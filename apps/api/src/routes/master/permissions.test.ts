import type { MasterStore } from "@vmb/db";
import { allPermissionKeys } from "@vmb/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Bindings } from "../../bindings.js";
import { withErrorReplies } from "../../error-reply.js";
import { createMasterRoutes } from "./index.js";

const ID = "d1000000-0000-4000-8000-000000000001";
const env = { DATABASE_URL: "postgres://test" } as Bindings;

/**
 * Every Master route and the one permission it demands. A caller holding every
 * key but that one must get 403 and must not reach the store; a caller holding
 * only that key must get past the check. The table is checked against the
 * routes the app actually registers, so a route added without a row here fails
 * "lists every registered route", and a row with the wrong key fails its own.
 */
const ROUTES = [
  ["GET", "/divisions", "master-divisions.view_any"],
  ["POST", "/divisions", "master-divisions.create"],
  ["GET", "/divisions/:id", "master-divisions.view"],
  ["PATCH", "/divisions/:id", "master-divisions.update"],
  ["DELETE", "/divisions/:id", "master-divisions.delete"],
  ["POST", "/divisions/:id/restore", "master-divisions.restore"],
  ["POST", "/divisions/:id/activate", "master-divisions.update"],
  ["POST", "/divisions/:id/deactivate", "master-divisions.update"],
  ["GET", "/roles", "master-roles.view_any"],
  ["POST", "/roles", "master-roles.create"],
  ["GET", "/roles/:id", "master-roles.view"],
  ["PATCH", "/roles/:id", "master-roles.update"],
  ["DELETE", "/roles/:id", "master-roles.delete"],
  ["GET", "/users", "master-users.view_any"],
  ["POST", "/users", "master-users.create"],
  ["GET", "/users/:id", "master-users.view"],
  ["PATCH", "/users/:id", "master-users.update"],
  ["DELETE", "/users/:id", "master-users.delete"],
  ["POST", "/users/:id/restore", "master-users.restore"]
] as const;

const concrete = (path: string) => path.replace(":id", ID);

function appFor(permissions: string[]) {
  const getPermissions = vi.fn(async () => permissions);
  // any other store method a request reaches is a failure: it throws
  const store = new Proxy({ getPermissions } as unknown as MasterStore, {
    get: (target, name: string) =>
      name in target
        ? target[name as keyof MasterStore]
        : () => {
            throw new Error(`the store was reached: ${name}`);
          }
  });
  const app = withErrorReplies(
    new Hono<{ Variables: { userId: string } }>()
      .use("*", async (c, next) => {
        c.set("userId", "caller");
        await next();
      })
      .route(
        "/",
        createMasterRoutes(() => store)
      )
  );
  return { app, getPermissions };
}

function request(method: string) {
  return {
    method,
    headers: { "content-type": "application/json" },
    // an empty body fails validation with a 400: past the permission check, short of the store
    body: method === "GET" || method === "DELETE" ? undefined : "{}"
  };
}

describe("master API permissions", () => {
  it.each(ROUTES)("%s %s needs %s", async (method, path, key) => {
    const without = appFor(allPermissionKeys().filter((candidate) => candidate !== key));
    const refused = await without.app.request(concrete(path), request(method), env);

    expect(refused.status).toBe(403);
    await expect(refused.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "You do not have permission to do that."
    });
    expect(without.getPermissions).toHaveBeenCalledWith("caller");

    const only = appFor([key]);
    const allowed = await only.app.request(concrete(path), request(method), env);

    // 400 for a body route (validation), anything but 403 otherwise
    expect(allowed.status).not.toBe(403);
  });

  it("refuses a caller with no roles at all", async () => {
    const { app } = appFor([]);

    const response = await app.request("/users", {}, env);

    expect(response.status).toBe(403);
  });

  it("reads the caller's permissions once per request, and again on the next", async () => {
    // a grant that exists for the first request and is removed before the second
    const granted = new Set<string>(["master-users.view_any"]);
    const getPermissions = vi.fn(async () => [...granted]);
    const store = {
      getPermissions,
      listUsers: vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 10 }))
    } as unknown as MasterStore;
    const app = withErrorReplies(
      new Hono<{ Variables: { userId: string } }>()
        .use("*", async (c, next) => {
          c.set("userId", "caller");
          await next();
        })
        .route(
          "/",
          createMasterRoutes(() => store)
        )
    );

    expect((await app.request("/users", {}, env)).status).toBe(200);
    expect(getPermissions).toHaveBeenCalledTimes(1);

    granted.delete("master-users.view_any");

    expect((await app.request("/users", {}, env)).status).toBe(403);
    expect(getPermissions).toHaveBeenCalledTimes(2);
  });

  // The request half of the statement budget: routes reach the database only
  // through the store, so pinning the store calls a role-changing PATCH makes,
  // with the statements each costs (packages/db/test/rbac.test.ts, "what a
  // request costs"), pins the request's total.
  it("changes a user's roles reading the caller's permissions once, and handing them on", async () => {
    const permissions = allPermissionKeys();
    const calls: string[] = [];
    const getPermissions = vi.fn(async () => permissions);
    const updateUser = vi.fn(async () => ({
      id: ID,
      name: "Rina Wijaya",
      status: "active",
      roles: [],
      phone: "+628111000001",
      email: "rina@vmblogistics.id",
      emailVerified: false,
      profilePhotoPath: "",
      createdAt: "2026-01-05T01:10:00.000Z",
      updatedAt: "2026-01-05T01:10:00.000Z",
      deletedAt: null
    }));
    const methods = { getPermissions, updateUser } as Record<string, unknown>;
    const store = new Proxy({} as MasterStore, {
      get: (_target, name: string) => {
        calls.push(name);
        return (
          methods[name] ??
          (() => {
            throw new Error(`the store was reached: ${name}`);
          })
        );
      }
    });
    const app = withErrorReplies(
      new Hono<{ Variables: { userId: string } }>()
        .use("*", async (c, next) => {
          c.set("userId", "caller");
          await next();
        })
        .route(
          "/",
          createMasterRoutes(
            () => store,
            async () => false
          )
        )
    );

    const response = await app.request(
      concrete("/users/:id"),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Rina Wijaya",
          email: "rina@vmblogistics.id",
          phone: "0811-1000-0001",
          roleIds: [ID],
          status: "active",
          profilePhotoPath: "",
          password: "",
          passwordConfirmation: "",
          updatedAt: "2026-01-05T01:10:00.000Z"
        })
      },
      env
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual(["getPermissions", "updateUser"]);
    expect(updateUser).toHaveBeenCalledWith(ID, expect.objectContaining({ roleIds: [ID] }), {
      id: "caller",
      permissions
    });
  });

  it("lists every registered route", () => {
    // each route registers once per handler (guard, validator, handler)
    const registered = [
      ...new Set(
        createMasterRoutes(() => ({}) as MasterStore)
          .routes.filter((route) => route.method !== "ALL")
          .map((route) => `${route.method} ${route.path}`)
      )
    ].sort();

    expect(ROUTES.map(([method, path]) => `${method} ${path}`).sort()).toEqual(registered);
  });
});
