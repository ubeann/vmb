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

const signUpEmail = vi.fn<() => Promise<{ data: null; error: { message?: string } | null }>>(
  async () => ({ data: null, error: null })
);
const client = { signUp: { email: signUpEmail } };

beforeEach(() => {
  withAuthApiClientMock.mockReset();
  signUpEmail.mockClear();
  withAuthApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run(client)
    })
  );
});

describe("signup action", () => {
  it("fails with the same message when any field is missing", async () => {
    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Name, email, and password are required." }
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("signs up with the fields and an absolute verification callback URL", async () => {
    await action(fakeAuthEvent({ name: "Ada", email: "a@example.com", password: "secret" }));

    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Ada",
      email: "a@example.com",
      password: "secret",
      callbackURL: "http://localhost/login?verified=true"
    });
  });

  it("returns success without a session on a clean signup", async () => {
    await expect(
      action(fakeAuthEvent({ name: "Ada", email: "a@example.com", password: "secret" }))
    ).resolves.toEqual({ success: true });
  });

  it("fails with Better Auth's message when signup is rejected", async () => {
    signUpEmail.mockResolvedValueOnce({ data: null, error: { message: "Email already in use" } });

    const result = await action(
      fakeAuthEvent({ name: "Ada", email: "a@example.com", password: "secret" })
    );

    expect(result).toMatchObject({ status: 400, data: { error: "Email already in use" } });
  });

  it("falls back to its own message when Better Auth reports none", async () => {
    signUpEmail.mockResolvedValueOnce({ data: null, error: {} });

    const result = await action(
      fakeAuthEvent({ name: "Ada", email: "a@example.com", password: "secret" })
    );

    expect(result).toMatchObject({ status: 400, data: { error: "Could not create account." } });
  });
});
