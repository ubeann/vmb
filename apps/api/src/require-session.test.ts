import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const authHandlerMock = vi.fn(() => new Response("auth-ok", { status: 200 }));

vi.mock("./auth.js", () => ({
  createAuth: () => ({ api: { getSession: getSessionMock }, handler: authHandlerMock })
}));

const listDivisionsMock = vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 10 }));

vi.mock("./master.js", () => ({
  masterStore: () =>
    ({
      listDivisions: listDivisionsMock,
      getPermissions: async () => ["master-divisions.view_any"],
      getAccess: async () => ({ permissions: ["master-divisions.view_any"], divisions: [] })
    }) as never
}));

const { default: app } = await import("./index.js");

const bindings = { DATABASE_URL: "postgres://test" };

beforeEach(() => {
  getSessionMock.mockReset();
  listDivisionsMock.mockClear();
  authHandlerMock.mockClear();
});

describe("the session guard", () => {
  it("rejects a protected API request when no session resolves", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const res = await app.request("/api/master/divisions", {}, bindings);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      code: "UNAUTHENTICATED",
      message: "Authentication required."
    });
    expect(listDivisionsMock).not.toHaveBeenCalled();
    expect(getSessionMock).toHaveBeenCalledWith({ headers: expect.any(Headers) });
  });

  it("passes a protected request with a session through to the route", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" }, session: { id: "s1" } });

    const res = await app.request("/api/master/divisions", {}, bindings);

    expect(res.status).toBe(200);
    expect(listDivisionsMock).toHaveBeenCalledTimes(1);
  });

  // Better Auth reads the client IP here too, so it gets the same vouched-for
  // address as on the auth routes, and never the secret (#250).
  it("hands Better Auth only a client IP the shared secret vouches for", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await app.request(
      "/api/master/divisions",
      {
        headers: {
          "cf-connecting-ip": "198.51.100.7",
          [CLIENT_IP_HEADER]: "203.0.113.5",
          [CLIENT_IP_SECRET_HEADER]: "guess"
        }
      },
      { ...bindings, CLIENT_IP_SECRET: "s3cret" }
    );

    const { headers } = getSessionMock.mock.calls[0]?.[0] as { headers: Headers };
    expect(headers.get(CLIENT_IP_HEADER)).toBe("198.51.100.7");
    expect(headers.has(CLIENT_IP_SECRET_HEADER)).toBe(false);
  });

  it("leaves the auth routes open", async () => {
    const res = await app.request("/api/auth/ok", {}, bindings);

    expect(res.status).toBe(200);
    expect(authHandlerMock).toHaveBeenCalledTimes(1);
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});

describe("the caller's own access", () => {
  it("answers a signed-in user with their permissions and divisions", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" }, session: { id: "s1" } });

    const res = await app.request("/api/me", {}, bindings);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      permissions: ["master-divisions.view_any"],
      divisions: []
    });
  });

  it("refuses an unauthenticated request", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const res = await app.request("/api/me", {}, bindings);

    expect(res.status).toBe(401);
  });
});
