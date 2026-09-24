import { describe, expect, it, vi } from "vitest";

// The session guard (#7) sits in front of /api/master; this fake lets the
// test reach the route's own validation without a real Better Auth session.
vi.mock("../../auth.js", () => ({
  createAuth: () => ({
    api: { getSession: async () => ({ user: { id: "u1" }, session: { id: "s1" } }) }
  })
}));

const { default: app } = await import("../../index.js");

describe("the master API mount", () => {
  it("validates an empty body under /api/master without touching the database", async () => {
    const response = await app.request(
      "/api/master/divisions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      },
      { DATABASE_URL: "postgresql://user:password@localhost:5432/app" }
    );
    const body = (await response.json()) as { error: string; issues: { path: string }[] };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validation failed.");
    expect(body.issues.map((issue) => issue.path).sort()).toEqual(["code", "name"]);
  });
});
