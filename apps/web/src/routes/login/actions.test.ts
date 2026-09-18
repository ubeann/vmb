import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — re-export the helper by its real path and mock the
// access seam the helper calls.
vi.mock("$lib/auth-action.js", () => import("../../lib/auth-action.js"));

vi.mock("../../lib/api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { actions } = await import("./+page.server.js");
const { fakeAuthEvent } = await import("../../lib/test-support.js");
const action = actions.default!;

const signInEmail = vi.fn<() => Promise<{ data: null; error: { message?: string } | null }>>(
  async () => ({ data: null, error: null })
);
const client = { signIn: { email: signInEmail } };

beforeEach(() => {
  withAuthApiClientMock.mockReset();
  signInEmail.mockClear();
  withAuthApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run(client)
    })
  );
});

describe("login action", () => {
  it("fails with the same message when email or password is missing", async () => {
    const result = await action(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Email and password are required." }
    });
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("signs in with the submitted email and password", async () => {
    await expect(
      action(fakeAuthEvent({ email: "a@example.com", password: "secret" }))
    ).rejects.toMatchObject({ status: 303 });

    expect(signInEmail).toHaveBeenCalledWith({ email: "a@example.com", password: "secret" });
  });

  it("fails with Better Auth's message for invalid credentials", async () => {
    signInEmail.mockResolvedValueOnce({ data: null, error: { message: "Invalid credentials" } });

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({ status: 400, data: { error: "Invalid credentials" } });
  });

  it("falls back to its own message when Better Auth reports none", async () => {
    signInEmail.mockResolvedValueOnce({ data: null, error: {} });

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({ status: 400, data: { error: "Invalid email or password." } });
  });

  it("redirects home on success", async () => {
    await expect(
      action(fakeAuthEvent({ email: "a@example.com", password: "secret" }))
    ).rejects.toMatchObject({ status: 303, location: "/" });
  });
});
