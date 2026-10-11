import { PGlite } from "@electric-sql/pglite";
import { createMasterStore, schema } from "@vmb/db";
import { allPermissionKeys, type Division, type User } from "@vmb/types";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bindings } from "../src/bindings.js";
import { withErrorReplies } from "../src/error-reply.js";
import { createMasterRoutes } from "../src/routes/master/index.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../migrations"
);
const env = { DATABASE_URL: "postgres://test" } as Bindings;
const CALLER = "d1000000-0000-4000-8000-000000000001";
const ACTOR = { id: CALLER, permissions: allPermissionKeys() };

/**
 * A Trashed division or user is read-only until restored (ADR-0055), through
 * the real routes on embedded Postgres: one test a write path, each saying
 * what the API answers and that the record did not move. The route tests
 * beside this one fake the store, and the store's tests skip the routes.
 */
describe("master API: a Trashed record is read-only", () => {
  const pglite = new PGlite();
  const store = createMasterStore(drizzle(pglite, { schema }), {
    hashPassword: async (password) => `hashed:${password}`
  });
  const app = withErrorReplies(
    new Hono<{ Variables: { userId: string } }>()
      .use("*", async (c, next) => {
        c.set("userId", CALLER);
        await next();
      })
      .route(
        "/",
        createMasterRoutes(
          () => ({ ...store, getPermissions: async () => allPermissionKeys() }),
          async () => false
        )
      )
  );

  const send = (method: string, url: string, body?: unknown) =>
    app.request(
      url,
      {
        method,
        ...(body === undefined
          ? {}
          : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      },
      env
    );
  const read = async <T>(url: string) => (await (await send("GET", url)).json()) as T;

  let serial = 0;
  async function trashedDivision() {
    serial += 1;
    const created = await store.createDivision({
      name: `Division ${serial}`,
      code: `DV${serial}`,
      description: "",
      colorHex: "#2563EB",
      iconName: "heroicon-o-cog-6-tooth",
      isActive: true
    });
    await store.deleteDivision(created.id);
    return store.getDivision(created.id);
  }
  async function trashedUser() {
    serial += 1;
    const created = await store.createUser(
      {
        name: `User ${serial}`,
        email: `user${serial}@vmblogistics.id`,
        phone: "+628111000001",
        roleIds: [],
        status: "active",
        profilePhotoPath: "",
        password: "password123456",
        passwordConfirmation: "password123456"
      },
      ACTOR
    );
    await store.deleteUser(created.id, ACTOR);
    return store.getUser(created.id);
  }

  const divisionEdit = (division: Division) => ({
    name: "Renamed",
    code: division.code,
    description: "",
    colorHex: "#2563EB",
    iconName: "heroicon-o-cog-6-tooth",
    isActive: true,
    updatedAt: division.updatedAt
  });
  const userEdit = (user: User, overrides: Record<string, unknown> = {}) => ({
    name: "Renamed",
    email: user.email,
    phone: "0811-1000-0001",
    roleIds: [],
    status: "active",
    profilePhotoPath: "",
    password: "",
    passwordConfirmation: "",
    updatedAt: user.updatedAt,
    ...overrides
  });

  beforeAll(async () => {
    await migrate(drizzle(pglite), { migrationsFolder });
    // the legacy baseline empties the session's search path; a real request starts on `public`
    await pglite.exec("set search_path = public");
    // replaying the chain on embedded Postgres takes seconds, more on a CI runner (as in @vmb/db)
  }, 60_000);

  afterAll(() => pglite.close());

  const notFound = (message: string) => ({ code: "NOT_FOUND", message });

  describe("a division", () => {
    it("is refused an edit, with the form it was opened from or a fresh one: 404, not 409", async () => {
      const division = await trashedDivision();

      const fresh = await send("PATCH", `/divisions/${division.id}`, divisionEdit(division));
      expect(fresh.status).toBe(404);
      await expect(fresh.json()).resolves.toMatchObject(notFound("Division not found."));

      const stale = await send("PATCH", `/divisions/${division.id}`, {
        ...divisionEdit(division),
        updatedAt: "2020-01-01T00:00:00.000Z"
      });
      expect(stale.status).toBe(404);

      await expect(read(`/divisions/${division.id}`)).resolves.toEqual(division);
    });

    it.each(["activate", "deactivate"])("is refused %s: 404, and stays as it was", async (verb) => {
      const division = await trashedDivision();

      const response = await send("POST", `/divisions/${division.id}/${verb}`);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject(notFound("Division not found."));
      await expect(read(`/divisions/${division.id}`)).resolves.toEqual(division);
    });

    it("is refused a second delete: 404, and the deletion date does not move", async () => {
      const division = await trashedDivision();

      const response = await send("DELETE", `/divisions/${division.id}`);

      expect(response.status).toBe(404);
      await expect(read(`/divisions/${division.id}`)).resolves.toEqual(division);
    });

    it("can still be read and restored, and then edited with the form it comes back with", async () => {
      const division = await trashedDivision();
      expect((await send("GET", `/divisions/${division.id}`)).status).toBe(200);

      const restored = await send("POST", `/divisions/${division.id}/restore`);
      expect(restored.status).toBe(200);
      const live = (await restored.json()) as Division;
      expect(live.deletedAt).toBeNull();

      // the form opened before the delete is stale now; the restored one is not
      const stale = await send("PATCH", `/divisions/${division.id}`, divisionEdit(division));
      expect(stale.status).toBe(409);
      await expect(stale.json()).resolves.toMatchObject({ code: "STALE_RECORD" });
      const fresh = await send("PATCH", `/divisions/${division.id}`, divisionEdit(live));
      expect(fresh.status).toBe(200);
    });

    it("is not restored while it is live: 404, and nothing changes", async () => {
      const division = await store.createDivision({
        name: "Live division",
        code: "LIVE",
        description: "",
        colorHex: "#2563EB",
        iconName: "heroicon-o-cog-6-tooth",
        isActive: true
      });

      const response = await send("POST", `/divisions/${division.id}/restore`);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject(notFound("Deleted division not found."));
      await expect(read(`/divisions/${division.id}`)).resolves.toEqual(division);
    });

    it("is refused a restore over a code reused meanwhile, naming the code", async () => {
      const division = await trashedDivision();
      await store.createDivision({
        name: "Another name",
        code: division.code,
        description: "",
        colorHex: "#2563EB",
        iconName: "heroicon-o-cog-6-tooth",
        isActive: true
      });

      const response = await send("POST", `/divisions/${division.id}/restore`);

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        code: "CONFLICT",
        issues: [{ path: "code" }]
      });
    });
  });

  describe("a user", () => {
    it.each([
      ["an edit", {}],
      ["a status change", { status: "suspended" }],
      ["a role assignment", { assignRole: true }],
      [
        "a password reset",
        { password: "anotherpassword12", passwordConfirmation: "anotherpassword12" }
      ]
    ])("is refused %s: 404, and stays as it was", async (_what, { assignRole, ...overrides }) => {
      const user = await trashedUser();
      if (assignRole) {
        const staff = await store.createRole({
          name: `Staff ${serial}`,
          description: "",
          colorHex: "#805AD5",
          iconName: "heroicon-o-user",
          isActive: true
        });
        Object.assign(overrides, { roleIds: [staff.id] });
      }

      const response = await send("PATCH", `/users/${user.id}`, userEdit(user, overrides));

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject(notFound("User not found."));
      await expect(read(`/users/${user.id}`)).resolves.toEqual(user);
    });

    it("is refused an edit from a form opened before the delete: 404, not 409", async () => {
      const user = await trashedUser();

      const response = await send(
        "PATCH",
        `/users/${user.id}`,
        userEdit(user, { updatedAt: "2020-01-01T00:00:00.000Z" })
      );

      expect(response.status).toBe(404);
    });

    it("is refused a second delete: 404, and the deletion date does not move", async () => {
      const user = await trashedUser();

      const response = await send("DELETE", `/users/${user.id}`);

      expect(response.status).toBe(404);
      await expect(read(`/users/${user.id}`)).resolves.toEqual(user);
    });

    it("is not restored while it is live: 404, and nothing changes", async () => {
      const user = await trashedUser();
      const live = await store.restoreUser(user.id, ACTOR);

      const response = await send("POST", `/users/${user.id}/restore`);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject(notFound("Deleted user not found."));
      await expect(read(`/users/${user.id}`)).resolves.toEqual(live);
    });

    it("can still be read and restored, and then edited with the form it comes back with", async () => {
      const user = await trashedUser();
      expect((await send("GET", `/users/${user.id}`)).status).toBe(200);

      const restored = await send("POST", `/users/${user.id}/restore`);
      expect(restored.status).toBe(200);
      const live = (await restored.json()) as User;
      expect(live.deletedAt).toBeNull();

      const stale = await send("PATCH", `/users/${user.id}`, userEdit(user));
      expect(stale.status).toBe(409);
      await expect(stale.json()).resolves.toMatchObject({ code: "STALE_RECORD" });
      const fresh = await send("PATCH", `/users/${user.id}`, userEdit(live));
      expect(fresh.status).toBe(200);
    });
  });
});
