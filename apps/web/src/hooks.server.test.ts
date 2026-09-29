import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();
withAuthApiClientMock.mockImplementation(
  async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
    ok: true,
    value: await run({ fakeClient: true })
  })
);
const loadSessionMock = vi.fn();

vi.mock("$lib/api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

vi.mock("$lib/session.js", () => ({
  loadSession: (client: unknown, cookie: string | null) => loadSessionMock(client, cookie)
}));

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — re-export the real module by its path.
vi.mock("$lib/public-routes.js", () => import("./lib/public-routes.js"));

const { handle, handleError } = await import("./hooks.server.js");

function fakeEvent(pathname = "/", routeId: string | null = pathname, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);

  return {
    platform: undefined,
    fetch: vi.fn(),
    request: new Request(`http://localhost${pathname}`, { headers }),
    url: new URL(`http://localhost${pathname}`),
    route: { id: routeId },
    locals: { session: "stale" as unknown, user: "stale" as unknown }
  };
}

beforeEach(() => {
  withAuthApiClientMock.mockClear();
  loadSessionMock.mockClear();
});

describe("handle", () => {
  it("populates locals.session/user from the resolved session and resolves the request", async () => {
    const session = { id: "sess_1" };
    const user = { id: "user_1" };
    loadSessionMock.mockResolvedValueOnce({ session, user });

    const event = fakeEvent("/", "/", "better-auth.session_token=abc");
    const resolve = vi.fn().mockResolvedValue(new Response("ok"));

    const res = await handle({ event, resolve } as never);

    expect(loadSessionMock).toHaveBeenCalledWith(
      expect.anything(),
      "better-auth.session_token=abc"
    );
    expect(event.locals.session).toBe(session);
    expect(event.locals.user).toBe(user);
    expect(resolve).toHaveBeenCalledWith(event);
    await expect(res.text()).resolves.toBe("ok");
  });

  it("sets null session/user when there is no active session", async () => {
    loadSessionMock.mockResolvedValueOnce({ session: null, user: null });

    const event = fakeEvent("/login");
    const resolve = vi.fn().mockResolvedValue(new Response("ok"));

    await handle({ event, resolve } as never);

    expect(event.locals.session).toBeNull();
    expect(event.locals.user).toBeNull();
  });

  it("degrades to logged-out instead of crashing the request when API access fails", async () => {
    withAuthApiClientMock.mockResolvedValueOnce({
      ok: false,
      error: new Error("API_URL is not configured for this deployment")
    });

    const event = fakeEvent("/login");
    const resolve = vi.fn().mockResolvedValue(new Response("ok"));

    const res = await handle({ event, resolve } as never);

    expect(loadSessionMock).not.toHaveBeenCalled();
    expect(event.locals.session).toBeNull();
    expect(event.locals.user).toBeNull();
    expect(resolve).toHaveBeenCalledWith(event);
    await expect(res.text()).resolves.toBe("ok");
  });

  it("redirects an unauthenticated request for a protected route before routing", async () => {
    loadSessionMock.mockResolvedValueOnce({ session: null, user: null });

    const event = fakeEvent("/master/users", "/master/users");
    const resolve = vi.fn();

    await expect(handle({ event, resolve } as never)).rejects.toMatchObject({
      status: 303,
      location: "/login"
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each(["/login", "/activate", "/logout"])(
    "leaves %s reachable without a session",
    async (pathname) => {
      loadSessionMock.mockResolvedValueOnce({ session: null, user: null });

      const event = fakeEvent(pathname, pathname);
      const resolve = vi.fn().mockResolvedValue(new Response("ok"));

      await handle({ event, resolve } as never);

      expect(resolve).toHaveBeenCalledWith(event);
    }
  );

  it("leaves non-route requests (static assets) alone", async () => {
    loadSessionMock.mockResolvedValueOnce({ session: null, user: null });

    const event = fakeEvent("/_app/immutable/entry.js", null);
    const resolve = vi.fn().mockResolvedValue(new Response("ok"));

    await handle({ event, resolve } as never);

    expect(resolve).toHaveBeenCalledWith(event);
  });
});

describe("handleError", () => {
  const event = fakeEvent("/warehouse/items", "/warehouse/items");

  it("gives an unexpected failure a reference and logs it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = handleError({
      error: new Error("boom"),
      event,
      status: 500,
      message: "Internal Error"
    } as never);

    expect(result).toEqual({
      message: "Internal Error",
      errorId: expect.stringMatching(/^[0-9a-f]{8}$/),
      occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    });
    const errorId = (result as { errorId: string }).errorId;
    expect(log).toHaveBeenCalledWith(expect.stringContaining(errorId), expect.any(Error));
    log.mockRestore();
  });

  it("leaves a missing page without a reference", () => {
    const result = handleError({
      error: new Error("Not found: /nowhere"),
      event,
      status: 404,
      message: "Not Found"
    } as never);

    expect(result).toEqual({ message: "Not Found" });
  });
});
