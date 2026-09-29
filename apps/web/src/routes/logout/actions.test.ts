import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifier the route itself imports.
vi.mock("$lib/api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { actions } = await import("./+page.server.js");
const { fakeAuthEvent } = await import("../../lib/test-support.js");

const signOutMock = vi.fn(async () => ({ data: null, error: null }));

beforeEach(() => {
  withAuthApiClientMock.mockReset();
  signOutMock.mockClear();
  withAuthApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run({ signOut: signOutMock })
    })
  );
});

describe("logout action", () => {
  it("signs the session out and returns to the login page", async () => {
    await expect(actions.default!(fakeAuthEvent())).rejects.toMatchObject({
      status: 303,
      location: "/login?logged_out=true"
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("still returns to the login page when the API is unreachable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    withAuthApiClientMock.mockResolvedValueOnce({ ok: false, error: new Error("down") });

    await expect(actions.default!(fakeAuthEvent())).rejects.toMatchObject({
      status: 303,
      location: "/login?logged_out=true"
    });

    expect(consoleError).toHaveBeenCalledWith(
      "logout action: request to API failed",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  // A refused sign-out (Better Auth's origin check, say) leaves the session
  // row valid, so it is logged, never silently dropped (#226).
  it("logs a sign-out the API refused, and still returns to the login page", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { status: 403, code: "INVALID_ORIGIN" };
    signOutMock.mockResolvedValueOnce({ data: null, error } as never);

    await expect(actions.default!(fakeAuthEvent())).rejects.toMatchObject({
      status: 303,
      location: "/login?logged_out=true"
    });

    expect(consoleError).toHaveBeenCalledWith("logout action: API refused sign-out", error);
    consoleError.mockRestore();
  });
});
