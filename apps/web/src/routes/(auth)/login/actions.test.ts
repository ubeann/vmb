import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — re-export the helper by its real path and mock the
// access seam the helper calls.
vi.mock("$lib/auth-action.js", () => import("../../../lib/auth-action.js"));

vi.mock("../../../lib/api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { actions } = await import("./+page.server.js");
const { fakeAuthEvent } = await import("../../../lib/test-support.js");
const action = actions.default!;

const signInEmail = vi.fn<
  () => Promise<{ data: null; error: { message?: string; code?: string } | null }>
>(async () => ({ data: null, error: null }));
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
  it("fails with a field error and never signs in when email or password is missing", async () => {
    const result = await action(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { password: "Enter your password" } }
    });
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("accepts any non-empty password, since the server compares it and the length rule is for new ones", async () => {
    await expect(
      action(fakeAuthEvent({ email: "a@example.com", password: "x" }))
    ).rejects.toMatchObject({ status: 303 });

    expect(signInEmail).toHaveBeenCalledWith(expect.objectContaining({ password: "x" }));
  });

  it("puts a malformed email on the email field, before the API is called", async () => {
    const result = await action(fakeAuthEvent({ email: "a@", password: "secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: "Enter a valid email, like name@company.com" } }
    });
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("signs in with the submitted email and password, not remembered when unticked", async () => {
    await expect(
      action(fakeAuthEvent({ email: "a@example.com", password: "secret" }))
    ).rejects.toMatchObject({ status: 303 });

    expect(signInEmail).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "secret",
      rememberMe: false
    });
  });

  it("asks Better Auth to remember the session when Remember me is ticked", async () => {
    await expect(
      action(fakeAuthEvent({ email: "a@example.com", password: "secret", rememberMe: "on" }))
    ).rejects.toMatchObject({ status: 303 });

    expect(signInEmail).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "secret",
      rememberMe: true
    });
  });

  it("fails with mapped VMB copy for a known error code, never Better Auth's raw message", async () => {
    signInEmail.mockResolvedValueOnce({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "email not verified" }
    });

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "nope" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Verify your email to sign in. Check your inbox for the verification link." }
    });
  });

  it("maps the sign-in gate's ACCOUNT_UNAVAILABLE to VMB copy", async () => {
    signInEmail.mockResolvedValueOnce({
      data: null,
      error: { code: "ACCOUNT_UNAVAILABLE", message: "This account is unavailable." }
    });

    const result = await action(fakeAuthEvent({ email: "a@example.com", password: "secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "This account is unavailable. Contact an administrator." }
    });
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
