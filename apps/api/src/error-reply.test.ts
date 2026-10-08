import { ApiErrorSchema } from "@vmb/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ADR-0048 at the root of the app: every error, whichever route it came from,
// is JSON `{ code, message, issues? }`.

const getSessionMock = vi.fn();
const getAccessMock = vi.fn();
const getPermissionsMock = vi.fn();

vi.mock("./auth.js", () => ({
  createAuth: () => ({ api: { getSession: getSessionMock } })
}));

vi.mock("./master.js", () => ({
  masterStore: () => ({ getAccess: getAccessMock, getPermissions: getPermissionsMock }) as never
}));

const { default: app } = await import("./index.js");

const bindings = { DATABASE_URL: "postgres://test" };
const signedIn = { user: { id: "u1" }, session: { id: "s1" } };

async function errorBody(response: Response) {
  expect(response.headers.get("content-type")).toMatch(/^application\/json/);
  return ApiErrorSchema.strict().parse(await response.json());
}

beforeEach(() => {
  getSessionMock.mockReset();
  getAccessMock.mockReset();
  getPermissionsMock.mockReset();
});

describe("the API error contract", () => {
  it("answers an unknown path 404 NOT_FOUND", async () => {
    const response = await app.request("/api/nowhere", {}, bindings);

    expect(response.status).toBe(404);
    expect(await errorBody(response)).toEqual({
      code: "NOT_FOUND",
      message: "There is nothing at this address."
    });
  });

  it("answers a store failure on GET /api/me 500 INTERNAL with generic copy, and logs it", async () => {
    const failure = new Error("connection to db.internal:5432 refused");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getSessionMock.mockResolvedValue(signedIn);
    getAccessMock.mockRejectedValue(failure);

    const response = await app.request("/api/me", {}, bindings);

    expect(response.status).toBe(500);
    expect(await errorBody(response)).toEqual({
      code: "INTERNAL",
      message: "Something went wrong. Please try again."
    });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("/api/me"), failure);
    logged.mockRestore();
  });

  it("answers a malformed JSON body 400 MALFORMED_REQUEST", async () => {
    getSessionMock.mockResolvedValue(signedIn);
    getPermissionsMock.mockResolvedValue(["master-divisions.create"]);

    const response = await app.request(
      "/api/master/divisions",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{" },
      bindings
    );

    expect(response.status).toBe(400);
    expect((await errorBody(response)).code).toBe("MALFORMED_REQUEST");
  });

  it("answers no session 401 UNAUTHENTICATED", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await app.request("/api/me", {}, bindings);

    expect(response.status).toBe(401);
    expect((await errorBody(response)).code).toBe("UNAUTHENTICATED");
  });

  it("answers a missing permission 403 FORBIDDEN", async () => {
    getSessionMock.mockResolvedValue(signedIn);
    getPermissionsMock.mockResolvedValue([]);

    const response = await app.request("/api/master/divisions", {}, bindings);

    expect(response.status).toBe(403);
    expect((await errorBody(response)).code).toBe("FORBIDDEN");
  });

  it("answers a schema failure 400 VALIDATION_FAILED with issues", async () => {
    getSessionMock.mockResolvedValue(signedIn);
    getPermissionsMock.mockResolvedValue(["master-divisions.create"]);

    const response = await app.request(
      "/api/master/divisions",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      bindings
    );

    expect(response.status).toBe(400);
    const body = await errorBody(response);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.issues?.map((issue) => issue.path).sort()).toEqual(["code", "name"]);
  });
});
