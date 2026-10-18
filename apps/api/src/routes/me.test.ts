import type { User } from "@vmb/types";
import { ForbiddenError } from "@vmb/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const getOwnProfileMock = vi.fn();
const updateOwnProfileMock = vi.fn();
const getPermissionsMock = vi.fn(async () => [] as string[]);

vi.mock("../auth.js", () => ({
  createAuth: () => ({ api: { getSession: getSessionMock } })
}));

vi.mock("../master.js", () => ({
  masterStore: () =>
    ({
      getOwnProfile: getOwnProfileMock,
      updateOwnProfile: updateOwnProfileMock,
      getPermissions: getPermissionsMock
    }) as never
}));

const { default: app } = await import("../index.js");

const bindings = { DATABASE_URL: "postgres://test" };
const ID = "d1000000-0000-4000-8000-000000000001";
const STAMP = "2026-10-05T03:04:00.123Z";
const profile: User = {
  id: ID,
  name: "Rina Wijaya",
  status: "active",
  roles: [],
  divisions: [],
  phone: "+628111000001",
  email: "rina@vmblogistics.id",
  emailVerified: true,
  profilePhotoPath: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null,
  withinReach: true
};

function patch(body: unknown) {
  return app.request(
    "/api/me/profile",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    },
    bindings
  );
}

beforeEach(() => {
  getSessionMock.mockReset().mockResolvedValue({ user: { id: ID }, session: { id: "s1" } });
  getOwnProfileMock.mockReset().mockResolvedValue(profile);
  updateOwnProfileMock.mockReset().mockResolvedValue(profile);
  getPermissionsMock.mockClear();
});

describe("GET /api/me/profile", () => {
  it("answers the caller's own record", async () => {
    const res = await app.request("/api/me/profile", {}, bindings);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: ID, email: "rina@vmblogistics.id" });
    expect(getOwnProfileMock).toHaveBeenCalledWith(ID);
  });

  it("refuses a request with no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const res = await app.request("/api/me/profile", {}, bindings);

    expect(res.status).toBe(401);
    expect(getOwnProfileMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/me/profile", () => {
  it("saves the caller's own name, phone and photo with no Master permission", async () => {
    const res = await patch({
      name: "  Rina W.  ",
      phone: "0811 1000 002",
      profilePhotoPath: "https://example.test/rina.png"
    });

    expect(res.status).toBe(200);
    expect(updateOwnProfileMock).toHaveBeenCalledWith(ID, {
      name: "Rina W.",
      phone: "+628111000002",
      profilePhotoPath: "https://example.test/rina.png"
    });
    expect(getPermissionsMock).not.toHaveBeenCalled();
  });

  it("takes the caller from the session, never from the body", async () => {
    await patch({
      id: "d1000000-0000-4000-8000-000000000002",
      name: "Rina W.",
      phone: "+628111000002"
    });

    expect(updateOwnProfileMock).toHaveBeenCalledWith(ID, expect.any(Object));
  });

  it("drops an email, a status or roles from the body, so none can be changed here", async () => {
    await patch({
      name: "Rina W.",
      phone: "+628111000002",
      email: "someone.else@vmblogistics.id",
      status: "suspended",
      roleIds: [ID]
    });

    expect(updateOwnProfileMock).toHaveBeenCalledWith(ID, {
      name: "Rina W.",
      phone: "+628111000002",
      profilePhotoPath: ""
    });
  });

  it("answers the admin form's rules: a name and an Indonesian phone are required", async () => {
    const res = await patch({ name: " ", phone: "12" });
    const body = (await res.json()) as { code: string; issues: { path: string }[] };

    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.issues.map((issue) => issue.path).sort()).toEqual(["name", "phone"]);
    expect(updateOwnProfileMock).not.toHaveBeenCalled();
  });

  it("refuses a request with no session", async () => {
    getSessionMock.mockResolvedValue(null);

    const res = await patch({ name: "Rina W.", phone: "+628111000002" });

    expect(res.status).toBe(401);
    expect(updateOwnProfileMock).not.toHaveBeenCalled();
  });

  it("answers a Trashed or non-Active caller 403 with the account's own copy", async () => {
    updateOwnProfileMock.mockRejectedValue(
      new ForbiddenError("FORBIDDEN", "This account is unavailable. Contact an administrator.")
    );

    const res = await patch({ name: "Rina W.", phone: "+628111000002" });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "This account is unavailable. Contact an administrator."
    });
  });
});
