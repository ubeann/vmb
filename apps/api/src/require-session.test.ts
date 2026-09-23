import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const authHandlerMock = vi.fn(() => new Response("auth-ok", { status: 200 }));

vi.mock("./auth.js", () => ({
  createAuth: () => ({ api: { getSession: getSessionMock }, handler: authHandlerMock })
}));

const listDivisionsMock = vi.fn(async () => ({ items: [], total: 0, page: 1, perPage: 10 }));

vi.mock("./master.js", () => ({
  masterStore: () => ({ listDivisions: listDivisionsMock }) as never
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
    await expect(res.json()).resolves.toMatchObject({ error: "Authentication required." });
    expect(listDivisionsMock).not.toHaveBeenCalled();
    expect(getSessionMock).toHaveBeenCalledWith({ headers: expect.any(Headers) });
  });

  it("passes a protected request with a session through to the route", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" }, session: { id: "s1" } });

    const res = await app.request("/api/master/divisions", {}, bindings);

    expect(res.status).toBe(200);
    expect(listDivisionsMock).toHaveBeenCalledTimes(1);
  });

  it("leaves the auth routes open", async () => {
    const res = await app.request("/api/auth/ok", {}, bindings);

    expect(res.status).toBe(200);
    expect(authHandlerMock).toHaveBeenCalledTimes(1);
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
