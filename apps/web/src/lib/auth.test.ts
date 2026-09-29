import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `getRequestEvent` is a SvelteKit virtual module the "unit" vitest project
// doesn't resolve (see vite.config.ts) — mock it directly rather than
// pulling in the real plugin.
const cookiesSet = vi.fn();
vi.mock("$app/server", () => ({
  getRequestEvent: () => ({ cookies: { set: cookiesSet } })
}));

const { createAuthApiClient } = await import("./auth.js");
const { loadSession } = await import("./session.js");

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
  // `__Secure-` names), and no cookie cache (ADR-0034).
  async function setUp() {
    const auth = betterAuth({
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      secret: "test-secret-that-is-long-enough-for-better-auth",
      baseURL: "https://api.test",
      emailAndPassword: { enabled: true }
    });
    await auth.api.signUpEmail({ body: { ...credentials, name: "A" } });

    const fetchFn = (input: RequestInfo | URL, init?: RequestInit) =>
      auth.handler(new Request(input, init));
    const client = createAuthApiClient("https://api.test", fetchFn as typeof fetch);
    return { client };
  }

  // What the browser holds: each cookie apps/web set, dropped when set with
  // `maxAge: 0` (how Better Auth expires one).
  const jar = new Map<string, string>();

  function lastCookieOptions(name: string) {
    const calls = cookiesSet.mock.calls.filter(([cookieName]) => cookieName === name);
    return calls.at(-1)?.[2] as { maxAge?: number; expires?: Date } | undefined;
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
    const { client } = await setUp();

    await client.signIn.email({ ...credentials, rememberMe: false });

    const session = lastCookieOptions(SESSION);
    expect(session).toBeDefined();
    expect(session?.maxAge).toBeUndefined();
    expect(session?.expires).toBeUndefined();

    const dontRemember = lastCookieOptions(DONT_REMEMBER);
    expect(dontRemember).toBeDefined();
    expect(dontRemember?.maxAge).toBeUndefined();
    expect(dontRemember?.expires).toBeUndefined();
  });

  it("gives a ticked sign-in today's 7-day cookie and no dont_remember", async () => {
    const { client } = await setUp();

    await client.signIn.email({ ...credentials, rememberMe: true });

    expect(lastCookieOptions(SESSION)?.maxAge).toBe(604800);
    expect(lastCookieOptions(DONT_REMEMBER)).toBeUndefined();
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

  // Logout calls signOut without forwarding the browser's cookies; Better Auth
  // expires its cookies regardless, so a later remembered sign-in never
  // inherits a stale dont_remember.
  it("expires both cookies on sign-out", async () => {
    const { client } = await setUp();
    await client.signIn.email({ ...credentials, rememberMe: false });

    await client.signOut();

    expect(jar.has(SESSION)).toBe(false);
    expect(jar.has(DONT_REMEMBER)).toBe(false);
  });
});
