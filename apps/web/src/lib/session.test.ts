import { describe, expect, it, vi } from "vitest";
import { loadSession } from "./session.js";

function fakeClient(getSession: (...args: unknown[]) => Promise<{ data: unknown }>) {
  return { getSession } as unknown as Parameters<typeof loadSession>[0];
}

describe("loadSession", () => {
  it("returns the session and user when Better Auth resolves one", async () => {
    const session = { id: "sess_1" };
    const user = { id: "user_1", email: "a@example.com" };
    const client = fakeClient(async () => ({ data: { session, user } }));

    await expect(loadSession(client, "better-auth.session_token=abc")).resolves.toEqual({
      session,
      user
    });
  });

  it("returns null session/user when there is no active session", async () => {
    const client = fakeClient(async () => ({ data: null }));

    await expect(loadSession(client, null)).resolves.toEqual({ session: null, user: null });
  });

  it("forwards the request's cookie header so the API can identify the session", async () => {
    const getSession = vi.fn(async () => ({ data: null }));
    const client = fakeClient(getSession);

    await loadSession(client, "better-auth.session_token=abc");

    expect(getSession).toHaveBeenCalledWith({
      fetchOptions: { headers: { cookie: "better-auth.session_token=abc" } }
    });
  });

  it("does not send a cookie header when the incoming request has none", async () => {
    const getSession = vi.fn(async () => ({ data: null }));
    const client = fakeClient(getSession);

    await loadSession(client, null);

    expect(getSession).toHaveBeenCalledWith({ fetchOptions: undefined });
  });

  it("propagates a transport failure so the API access seam can own it", async () => {
    const client = fakeClient(async () => {
      throw new Error("network down");
    });

    await expect(loadSession(client, null)).rejects.toThrow("network down");
  });
});
