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

const { handle } = await import("./hooks.server.js");

function fakeEvent(cookie: string | null) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);

  return {
    platform: undefined,
    fetch: vi.fn(),
    request: new Request("http://localhost/", { headers }),
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

    const event = fakeEvent("better-auth.session_token=abc");
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

    const event = fakeEvent(null);
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

    const event = fakeEvent(null);
    const resolve = vi.fn().mockResolvedValue(new Response("ok"));

    const res = await handle({ event, resolve } as never);

    expect(loadSessionMock).not.toHaveBeenCalled();
    expect(event.locals.session).toBeNull();
    expect(event.locals.user).toBeNull();
    expect(resolve).toHaveBeenCalledWith(event);
    await expect(res.text()).resolves.toBe("ok");
  });
});
