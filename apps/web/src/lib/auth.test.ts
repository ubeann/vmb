import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Exercise the same cookie store and header writer SvelteKit uses for form
// action responses. These are internal helpers, so an upgrade that changes
// this path must recheck the response-boundary assertion below.
// @ts-expect-error SvelteKit does not publish types for its internal cookie module.
import * as svelteKitCookies from "../../node_modules/@sveltejs/kit/src/runtime/server/cookie.js";

// `getRequestEvent` is a SvelteKit virtual module the "unit" vitest project
// doesn't resolve (see vite.config.ts) — mock it directly rather than
// pulling in the real plugin.
const cookiesSet = vi.fn();
vi.mock("$app/server", () => ({
  getRequestEvent: () => ({ cookies: { set: cookiesSet } })
}));

const { createAuthApiClient } = await import("./auth.js");
const { loadSession } = await import("./session.js");
const { withAuthApiClient } = await import("./api-access.js");

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

// Remember me (#206), end to end through the bridge: a real Better Auth stands
// in for apps/api, so the cookies asserted here are the ones Better Auth itself
// emits, after the bridge has re-set them on apps/web's response.
describe("remember me through the cookie bridge", () => {
  const SESSION = "__Secure-better-auth.session_token";
  const DONT_REMEMBER = "__Secure-better-auth.dont_remember";
  const credentials = { email: "a@example.com", password: "correct-horse-battery" };

  // apps/api's session settings: Better Auth's defaults, an https base URL (so
  // `__Secure-` names), apps/web as the one trusted origin, and no cookie cache
  // (ADR-0034). apps/web sits on another registrable domain, as in production.
  async function setUp() {
    const auth = betterAuth({
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      secret: "test-secret-that-is-long-enough-for-better-auth",
      baseURL: "https://api.test",
      trustedOrigins: ["https://web.test"],
      emailAndPassword: { enabled: true },
      // Better Auth skips its origin/CSRF check when NODE_ENV is "test"; keep
      // it on, as in production, so logout's cookie-carrying POST must pass it.
      advanced: { disableOriginCheck: false }
    });
    await auth.api.signUpEmail({ body: { ...credentials, name: "A" } });

    const fetchFn = (input: RequestInfo | URL, init?: RequestInit) =>
      auth.handler(new Request(input, init));
    const client = createAuthApiClient("https://api.test", fetchFn as typeof fetch);
    return { client, fetchFn };
  }

  // A form POST to apps/web's /logout, as the access seam sees it. Its fetch
  // goes straight to Better Auth, adding only what SvelteKit's `event.fetch`
  // adds on its own for an API on another domain: apps/web's origin, never the
  // browser's cookies. Those the seam must forward itself (#226).
  function logoutEvent(fetchFn: typeof fetch, cookie: string) {
    return {
      platform: undefined,
      request: new Request("https://web.test/logout", { method: "POST", headers: { cookie } }),
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (!headers.has("origin")) headers.set("origin", "https://web.test");
        return fetchFn(input, { ...init, headers });
      }
    };
  }

  // What the browser holds: each cookie apps/web set, dropped when set with
  // `maxAge: 0` (how Better Auth expires one).
  const jar = new Map<string, string>();

  function lastCookieOptions(name: string) {
    const calls = cookiesSet.mock.calls.filter(([cookieName]) => cookieName === name);
    return calls.at(-1)?.[2] as { maxAge?: number; expires?: Date } | undefined;
  }

  async function webResponseCookies(rememberMe: boolean) {
    const url = new URL("https://web.test/login");
    const { cookies, new_cookies, set_trailing_slash } = svelteKitCookies.get_cookies(
      new Request(url),
      url
    );
    set_trailing_slash("never");
    cookiesSet.mockImplementation(cookies.set);

    const { client } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe });

    const headers = new Headers();
    svelteKitCookies.add_cookies_to_headers(headers, new_cookies.values());
    return headers.getSetCookie();
  }

  function cookieHeader(omit: string[] = []) {
    return [...jar]
      .filter(([name]) => !omit.includes(name))
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join("; ");
  }

  beforeEach(() => {
    jar.clear();
    cookiesSet.mockImplementation((name: string, value: string, options: { maxAge?: number }) => {
      if (options.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives an unticked sign-in a browser-session cookie, and forwards dont_remember", async () => {
    const setCookies = await webResponseCookies(false);

    const session = lastCookieOptions(SESSION);
    expect(session).toBeDefined();
    expect(session?.maxAge).toBeUndefined();
    expect(session?.expires).toBeUndefined();

    const dontRemember = lastCookieOptions(DONT_REMEMBER);
    expect(dontRemember).toBeDefined();
    expect(dontRemember?.maxAge).toBeUndefined();
    expect(dontRemember?.expires).toBeUndefined();

    for (const name of [SESSION, DONT_REMEMBER]) {
      const header = setCookies.find((cookie) => cookie.startsWith(`${name}=`));
      expect(header).toBeDefined();
      expect(header).not.toMatch(/(?:^|;)\s*(?:Max-Age|Expires)=/i);
    }
  });

  it("gives a ticked sign-in today's 7-day cookie and no dont_remember", async () => {
    const setCookies = await webResponseCookies(true);

    expect(lastCookieOptions(SESSION)?.maxAge).toBe(604800);
    expect(lastCookieOptions(DONT_REMEMBER)).toBeUndefined();
    expect(setCookies.find((cookie) => cookie.startsWith(`${SESSION}=`))).toMatch(
      /(?:^|;)\s*Max-Age=604800(?:;|$)/i
    );
    expect(setCookies.some((cookie) => cookie.startsWith(`${DONT_REMEMBER}=`))).toBe(false);
  });

  it("never turns a browser-session cookie persistent when the session is next read", async () => {
    const { client } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe: false });
    cookiesSet.mockClear();

    const { user } = await loadSession(client, cookieHeader());

    // Better Auth skips the refresh entirely for a don't-remember session, so
    // the browser keeps the session cookie it already has.
    expect(user?.email).toBe(credentials.email);
    expect(lastCookieOptions(SESSION)).toBeUndefined();
  });

  // The control for the test above: the forwarded dont_remember cookie is the
  // only thing keeping Better Auth from refreshing the session into a
  // persistent 7-day cookie. Drop it and that refresh happens on the next read.
  it("would re-persist the session if dont_remember were not forwarded", async () => {
    const { client } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe: false });
    cookiesSet.mockClear();

    await loadSession(client, cookieHeader([DONT_REMEMBER]));

    expect(lastCookieOptions(SESSION)?.maxAge).toBe(604800);
  });

  it("still refreshes a remembered session after a day of use", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { client } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe: true });
    cookiesSet.mockClear();

    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    const { user } = await loadSession(client, cookieHeader());

    expect(user?.email).toBe(credentials.email);
    expect(lastCookieOptions(SESSION)?.maxAge).toBe(604800);
  });

  // Better Auth expires its cookies on sign-out, so a later remembered sign-in
  // never inherits a stale dont_remember.
  it("expires both cookies on sign-out", async () => {
    const { client, fetchFn } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe: false });

    await withAuthApiClient(logoutEvent(fetchFn as typeof fetch, cookieHeader()), (c) =>
      c.signOut()
    );

    expect(jar.has(SESSION)).toBe(false);
    expect(jar.has(DONT_REMEMBER)).toBe(false);
  });

  it("revokes the session on logout, so the old cookie no longer authenticates", async () => {
    const { client, fetchFn } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe: true });
    const browserCookie = cookieHeader();

    const access = await withAuthApiClient(
      logoutEvent(fetchFn as typeof fetch, browserCookie),
      (c) => c.signOut()
    );

    expect(access).toMatchObject({ ok: true, value: { error: null } });
    const { user } = await loadSession(client, browserCookie);
    expect(user).toBeNull();
  });

  // Why the Origin matters: with the cookie but no Origin, Better Auth's CSRF
  // check refuses the sign-out. `event.fetch` supplies apps/web's origin, and
  // apps/api must keep trusting it (`trustedOrigins: [WEB_URL]`).
  it("would refuse a sign-out that carries the cookie but no Origin", async () => {
    const { client } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe: true });
    const browserCookie = cookieHeader();

    const { error } = await client.signOut({
      fetchOptions: { headers: { cookie: browserCookie } }
    });

    expect(error?.status).toBe(403);
    expect((await loadSession(client, browserCookie)).user?.email).toBe(credentials.email);
  });
});
