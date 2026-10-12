import { PGlite } from "@electric-sql/pglite";
import { createMasterStore, schema } from "@vmb/db";
import { allPermissionKeys, type DivisionListResponse } from "@vmb/types";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Bindings } from "../src/bindings.js";
import { withErrorReplies } from "../src/error-reply.js";
import { createMasterRoutes } from "../src/routes/master/index.js";

// The repository's migration chain, the same one `@vmb/db`'s tests replay.
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../migrations"
);
const env = { DATABASE_URL: "postgres://test" } as Bindings;
const CALLER = "d1000000-0000-4000-8000-000000000001";

/**
 * The Divisions list end to end, from the query string to the SQL, on
 * embedded Postgres: the route tests beside this one fake the store, and the
 * store's tests skip the query string. Only the caller's permissions are
 * faked, since the caller has no user row.
 */
describe("master API: the divisions list on Postgres", () => {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });
  const store = createMasterStore(db, {
    hashPassword: async (password) => `hashed:${password}`,
    transaction: (work) => db.transaction(work)
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

  const list = async (search: string) => {
    const response = await app.request(`/divisions?${search}`, {}, env);
    expect(response.status).toBe(200);
    return (await response.json()) as DivisionListResponse;
  };

  beforeAll(async () => {
    await migrate(drizzle(pglite), { migrationsFolder });
    // the legacy baseline empties the session's search path; a real request starts on `public`
    await pglite.exec("set search_path = public");
    const insert = (code: string, name: string, active: boolean, stamp: string, deleted = false) =>
      pglite.exec(
        `insert into master.divisions (name, code, color_hex, icon_name, is_active, created_at, updated_at, deleted_at)
          values ('${name}', '${code}', '#000000', 'heroicon-o-home', ${active}, '${stamp}', '${stamp}', ${deleted ? `'${stamp}'` : "null"})`
      );
    // Jakarta is UTC+7: the first two are 31 December and 1 January there, the same day in UTC
    await insert("OPS", "Ops Year End", true, "2025-12-31T16:30:00Z");
    await insert("OPN", "Ops New Year", false, "2025-12-31T17:30:00Z");
    await insert("OPT", "Ops Trashed", true, "2026-01-02T03:00:00Z", true);
    await insert("FIN", "Finance", true, "2026-01-02T03:00:00Z");
    // replaying the chain on embedded Postgres takes seconds, more on a CI runner (as in @vmb/db)
  }, 60_000);

  afterAll(() => pglite.close());

  it("filters by several statuses and a date range across the year end, in the reader's zone", async () => {
    const jakarta = await list("status=active,inactive&updated=2025-12-31..2025-12-31&sort=code");
    expect(jakarta.items.map((item) => item.code)).toEqual(["OPS"]);

    const utc = await list(
      "status=active,inactive&updated=2025-12-31..2025-12-31&tz=UTC&sort=code"
    );
    expect(utc.items.map((item) => item.code)).toEqual(["OPN", "OPS"]);
  });

  it("counts each view and each status option with the search kept", async () => {
    await expect(list("search=ops&status=inactive")).resolves.toMatchObject({
      total: 1,
      views: { all: 1, trash: 0 },
      facets: { status: { active: 1, inactive: 1 } }
    });
    await expect(list("search=ops&updated=2025-12-01..2026-01-31")).resolves.toMatchObject({
      total: 2,
      views: { all: 2, trash: 1 },
      facets: { status: { active: 1, inactive: 1 } }
    });
  });

  it("reads the old status=all as any status", async () => {
    await expect(list("status=all")).resolves.toMatchObject({ total: 3 });
  });
});
