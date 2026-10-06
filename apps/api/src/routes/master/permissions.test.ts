import type { MasterStore } from "@vmb/db";
import { allPermissionKeys } from "@vmb/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Bindings } from "../../bindings.js";
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
  const getAccess = vi.fn(async () => ({ permissions, divisions: [] }));
  // any other store method a request reaches is a failure: it throws
  const store = new Proxy({ getAccess } as unknown as MasterStore, {
    get: (target, name: string) =>
      name in target
        ? target[name as keyof MasterStore]
        : () => {
            throw new Error(`the store was reached: ${name}`);
          }
  });
  const app = new Hono<{ Variables: { userId: string } }>()
    .use("*", async (c, next) => {
      c.set("userId", "caller");
      await next();
    })
    .route(
      "/",
      createMasterRoutes(() => store)
    );
  return { app, getAccess };
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
      error: "You do not have permission to do that."
    });
    expect(without.getAccess).toHaveBeenCalledWith("caller");

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
