import { beforeEach, describe, expect, it, vi } from "vitest";

// `getRequestEvent` is a SvelteKit virtual module the "unit" vitest project
// doesn't resolve (see vite.config.ts) — mock it directly rather than
// pulling in the real plugin.
const cookiesSet = vi.fn();
vi.mock("$app/server", () => ({
  getRequestEvent: () => ({ cookies: { set: cookiesSet } })
}));

const { createAuthApiClient } = await import("./auth.js");

function stubFetch(setCookieHeader: string | null, body: unknown) {
  return vi.fn(async () => {
    const headers = new Headers();
    if (setCookieHeader) headers.set("set-cookie", setCookieHeader);
    return new Response(JSON.stringify(body), { status: 200, headers });
  });
}

beforeEach(() => {
  cookiesSet.mockReset();
});

describe("createAuthApiClient", () => {
  it("forwards the API's Set-Cookie onto the SvelteKit response", async () => {
    const fetchFn = stubFetch(
      "__Secure-better-auth.session_token=abc123; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax",
      { redirect: false, token: "abc123", user: { id: "u1" } }
    );
    const client = createAuthApiClient("http://api.test", fetchFn as unknown as typeof fetch);

    await client.signIn.email({ email: "a@example.com", password: "secret" });

    expect(cookiesSet).toHaveBeenCalledWith(
      "__Secure-better-auth.session_token",
      "abc123",
      expect.objectContaining({
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 604800
      })
    );
  });

  it("does nothing when the API response carries no Set-Cookie", async () => {
    const fetchFn = stubFetch(null, { redirect: false, token: null, user: null });
    const client = createAuthApiClient("http://api.test", fetchFn as unknown as typeof fetch);

    await client.signIn.email({ email: "a@example.com", password: "wrong" });

    expect(cookiesSet).not.toHaveBeenCalled();
  });
});
