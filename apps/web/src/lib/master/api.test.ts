import { DivisionListQuerySchema, RoleListQuerySchema } from "@vmb/types";
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../api.js";
import {
  createDivision,
  deleteDivision,
  getDivision,
  listDivisions,
  listRoles,
  restoreDivision,
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
  iconName: "heroicon-o-cog-6-tooth",
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
    const { client, calls } = clientWith(() =>
      json({ items: [division], total: 1, page: 1, perPage: 10 })
    );
    const query = DivisionListQuerySchema.parse({ search: "ops", perPage: "25", trashed: "only" });

    const result = await listDivisions(client, query);

    expect(result).toEqual({
      ok: true,
      value: { items: [division], total: 1, page: 1, perPage: 10 }
    });
    expect(calls[0]?.path).toBe(
      "/api/master/divisions?search=ops&status=all&trashed=only&sort=name&dir=asc&page=1&perPage=25"
    );
    expect(calls[0]?.method).toBe("GET");
  });

  it("creates a division with a JSON body", async () => {
    const { client, calls } = clientWith(() => json(division, 201));
    const input = {
      name: "Operations",
      code: "OPS",
      description: "",
      colorHex: "#2563EB",
      iconName: "heroicon-o-cog-6-tooth",
      isActive: true
    };

    const result = await createDivision(client, input);

    expect(result.ok).toBe(true);
    expect(calls[0]?.path).toBe("/api/master/divisions");
    expect(calls[0]?.method).toBe("POST");
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual(input);
  });

  it("reads, updates, deletes and restores by id", async () => {
    const { client, calls } = clientWith((call) => {
      if (call.method === "GET") return json(division);
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
      iconName: "heroicon-o-cog-6-tooth",
      isActive: true
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

  it("maps an API failure to its status and message", async () => {
    const { client } = clientWith(() => json({ error: "Division not found." }, 404));

    await expect(getDivision(client, ID)).resolves.toEqual({
      ok: false,
      status: 404,
      error: "Division not found."
    });
  });

  it("falls back to a generic message when the body carries none", async () => {
    const { client } = clientWith(() => new Response("nope", { status: 500 }));

    await expect(deleteDivision(client, ID)).resolves.toMatchObject({
      ok: false,
      status: 500,
      error: "Something went wrong. Please try again."
    });
  });

  it("lists roles through their own query schema", async () => {
    const { client, calls } = clientWith(() => json({ items: [], total: 0, page: 1, perPage: 10 }));

    await listRoles(client, RoleListQuerySchema.parse({}));

    expect(calls[0]?.path).toBe(
      "/api/master/roles?level=all&active=all&sort=level&dir=desc&page=1&perPage=10"
    );
  });
});
