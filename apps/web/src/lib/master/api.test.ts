import { DivisionListRequestSchema, RoleListRequestSchema } from "@vmb/types";
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../api.js";
import {
  bulkDivisions,
  bulkUsers,
  createDivision,
  deleteDivision,
  getDivision,
  getRole,
  listDivisions,
  listRoles,
  restoreDivision,
  setDivisionActive,
  updateDivision
} from "./api.js";

const STAMP = "2026-01-05T01:10:00.000Z";
const ID = "d1000000-0000-4000-8000-000000000001";

const division = {
  id: ID,
  name: "Operations",
  code: "OPS",
  description: null,
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

type Call = { path: string; method: string; body: string | null };

function clientWith(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const call: Call = {
      path: url.pathname + url.search,
      method: request.method,
      body: request.body ? await request.clone().text() : null
    };
    calls.push(call);
    return respond(call);
  });

  return { client: createApiClient("http://api.test", fetchMock as typeof fetch), calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

describe("master API client", () => {
  it("lists divisions with the query string the schema produced", async () => {
    const page = {
      items: [division],
      total: 1,
      page: 1,
      perPage: 10,
      views: { all: 1, trash: 0 },
      facets: { status: { active: 1, inactive: 0 } }
    };
    const { client, calls } = clientWith(() => json(page));
    const query = DivisionListRequestSchema.parse({
      search: "ops",
      perPage: "25",
      trashed: "only"
    });

    const result = await listDivisions(client, query);

    expect(result).toEqual({ ok: true, value: page });
    expect(calls[0]?.path).toBe(
      "/api/master/divisions?search=ops&trashed=only&sort=name&dir=asc&page=1&perPage=25&tz=Asia%2FJakarta"
    );
    expect(calls[0]?.method).toBe("GET");
  });

  it("sends several statuses as one comma-separated parameter", async () => {
    const { client, calls } = clientWith(() => json({}, 500));
    const query = DivisionListRequestSchema.parse({
      status: "active,inactive",
      updated: "2025-12-29..2026-01-04"
    });

    await listDivisions(client, query);

    const url = new URL(`http://api.test${calls[0]?.path}`);
    expect(url.searchParams.get("status")).toBe("active,inactive");
    expect(url.searchParams.get("updated")).toBe("2025-12-29..2026-01-04");
  });

  it("creates a division with a JSON body", async () => {
    const { client, calls } = clientWith(() => json(division, 201));
    const input = {
      name: "Operations",
      code: "OPS",
      description: "",
      colorHex: "#2563EB",
      iconName: "settings" as const,
      isActive: true
    };

    const result = await createDivision(client, input);

    expect(result.ok).toBe(true);
    expect(calls[0]?.path).toBe("/api/master/divisions");
    expect(calls[0]?.method).toBe("POST");
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual(input);
  });

  it("reads a division with its user count", async () => {
    const { client } = clientWith(() => json({ ...division, userCount: 3 }));

    await expect(getDivision(client, ID)).resolves.toEqual({
      ok: true,
      value: { ...division, userCount: 3 }
    });
  });

  it("reads, updates, deletes and restores by id", async () => {
    const { client, calls } = clientWith((call) => {
      if (call.method === "GET") return json({ ...division, userCount: 0 });
      if (call.method === "PATCH") return json({ ...division, name: "Operations HQ" });
      if (call.method === "DELETE") return new Response(null, { status: 204 });
      return json(division);
    });

    await getDivision(client, ID);
    await updateDivision(client, ID, {
      name: "Operations HQ",
      code: "OPS",
      description: "",
      colorHex: "#2563EB",
      iconName: "settings",
      isActive: true,
      updatedAt: STAMP
    });
    await deleteDivision(client, ID);
    await restoreDivision(client, ID);

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET /api/master/divisions/${ID}`,
      `PATCH /api/master/divisions/${ID}`,
      `DELETE /api/master/divisions/${ID}`,
      `POST /api/master/divisions/${ID}/restore`
    ]);
  });

  it("sends the updatedAt it was given with an update, and reads a stale one as a conflict", async () => {
    const message = "This record was changed by someone else since you opened it.";
    const { client, calls } = clientWith(() =>
      json({ code: "STALE_RECORD", message, issues: [{ path: "updatedAt", message }] }, 409)
    );

    const result = await updateDivision(client, ID, {
      name: "Operations HQ",
      code: "OPS",
      description: "",
      colorHex: "#2563EB",
      iconName: "settings",
      isActive: true,
      updatedAt: STAMP
    });

    expect(JSON.parse(calls[0]?.body ?? "")).toMatchObject({ updatedAt: STAMP });
    expect(result).toEqual({
      ok: false,
      status: 409,
      code: "STALE_RECORD",
      error: message,
      issues: [{ path: "updatedAt", message }]
    });
  });

  it("switches a division with the status-only endpoints and no lookup first", async () => {
    const { client, calls } = clientWith((call) =>
      json({ ...division, isActive: call.path.endsWith("/activate") })
    );

    await expect(setDivisionActive(client, ID, false)).resolves.toMatchObject({
      ok: true,
      value: { isActive: false }
    });
    await expect(setDivisionActive(client, ID, true)).resolves.toMatchObject({
      ok: true,
      value: { isActive: true }
    });

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `POST /api/master/divisions/${ID}/deactivate`,
      `POST /api/master/divisions/${ID}/activate`
    ]);
    expect(calls.every((call) => call.body === null)).toBe(true);
  });

  it("maps a missing or Trashed division to 404 when switching it", async () => {
    const { client } = clientWith(() =>
      json({ code: "NOT_FOUND", message: "Division not found." }, 404)
    );

    await expect(setDivisionActive(client, ID, true)).resolves.toMatchObject({
      ok: false,
      status: 404,
      code: "NOT_FOUND"
    });
  });

  it("maps an API failure to its status, code and message", async () => {
    const { client } = clientWith(() =>
      json({ code: "NOT_FOUND", message: "Division not found." }, 404)
    );

    await expect(getDivision(client, ID)).resolves.toEqual({
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: "Division not found.",
      issues: []
    });
  });

  it("carries the issues a conflict names", async () => {
    const taken = { path: "code", message: "A division with that code already exists." };
    const { client } = clientWith(() =>
      json({ code: "CONFLICT", message: taken.message, issues: [taken] }, 409)
    );

    await expect(getDivision(client, ID)).resolves.toMatchObject({
      ok: false,
      status: 409,
      code: "CONFLICT",
      error: taken.message,
      issues: [taken]
    });
  });

  it("falls back to the status's generic copy for a code it does not know", async () => {
    const { client } = clientWith(() =>
      json({ code: "SOMETHING_NEW", message: "Internal detail nobody should read." }, 403)
    );

    await expect(deleteDivision(client, ID)).resolves.toEqual({
      ok: false,
      status: 403,
      code: "SOMETHING_NEW",
      error: "You do not have permission to do that.",
      issues: []
    });
  });

  it("falls back to a generic message when the body carries none", async () => {
    const { client } = clientWith(() => new Response("nope", { status: 500 }));

    await expect(deleteDivision(client, ID)).resolves.toMatchObject({
      ok: false,
      status: 500,
      code: "INTERNAL",
      error: "Something went wrong. Please try again.",
      issues: []
    });
  });

  it("lists roles through their own request schema, several statuses as one parameter", async () => {
    const { client, calls } = clientWith(() =>
      json({
        items: [],
        total: 0,
        page: 1,
        perPage: 10,
        facets: { status: { active: 0, inactive: 0 } }
      })
    );

    await listRoles(
      client,
      RoleListRequestSchema.parse({ status: "active,inactive", updated: "week", search: "adm" })
    );

    expect(calls[0]?.path).toBe(
      "/api/master/roles?search=adm&status=active%2Cinactive&updated=week&sort=name&dir=asc&page=1&perPage=25&tz=Asia%2FJakarta"
    );
  });

  it("reads a role's detail with its division's name", async () => {
    const { client } = clientWith(() =>
      json({
        id: ID,
        name: "Dispatcher",
        isActive: true,
        isSystem: false,
        colorHex: "#2563EB",
        iconName: "user",
        description: null,
        divisionId: ID,
        divisionName: "Hub",
        divisionInactive: true,
        userCount: 2,
        permissionCount: 1,
        grantable: true,
        permissionKeys: ["master-users.view_any"],
        createdAt: STAMP,
        updatedAt: STAMP
      })
    );

    await expect(getRole(client, ID)).resolves.toMatchObject({
      ok: true,
      value: {
        divisionName: "Hub",
        divisionInactive: true,
        userCount: 2,
        permissionKeys: ["master-users.view_any"]
      }
    });
  });
});

describe("master API client: bulk actions (#305)", () => {
  const OTHER = "d1000000-0000-4000-8000-000000000002";

  it("posts a bulk delete of divisions and reads the ids it changed", async () => {
    const { client, calls } = clientWith(() => json({ ids: [ID, OTHER] }));

    await expect(bulkDivisions(client, { action: "delete", ids: [ID, OTHER] })).resolves.toEqual({
      ok: true,
      value: { ids: [ID, OTHER] }
    });

    expect(calls).toEqual([
      {
        path: "/api/master/divisions/bulk",
        method: "POST",
        body: JSON.stringify({ action: "delete", ids: [ID, OTHER] })
      }
    ]);
  });

  it("posts a bulk restore of users", async () => {
    const { client, calls } = clientWith(() => json({ ids: [ID] }));

    await expect(bulkUsers(client, { action: "restore", ids: [ID] })).resolves.toMatchObject({
      ok: true
    });

    expect(calls[0]).toMatchObject({ path: "/api/master/users/bulk", method: "POST" });
  });

  it("hands back the refusal's own copy, which names the divisions in use", async () => {
    const message = "1 of the 2 selected divisions still has roles: “Busy” (1 role).";
    const { client } = clientWith(() => json({ code: "DIVISION_IN_USE", message }, 409));

    await expect(bulkDivisions(client, { action: "delete", ids: [ID, OTHER] })).resolves.toEqual({
      ok: false,
      status: 409,
      code: "DIVISION_IN_USE",
      error: message,
      issues: []
    });
  });
});
