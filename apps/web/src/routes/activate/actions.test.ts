import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();

vi.mock("$lib/auth-action.js", () => import("../../lib/auth-action.js"));

vi.mock("../../lib/api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { actions } = await import("./+page.server.js");
const { fakeAuthEvent } = await import("../../lib/test-support.js");

const requestMock = vi.fn<() => Promise<{ data: null; error: { message?: string } | null }>>(
  async () => ({ data: null, error: null })
);
const resetMock = vi.fn<
  () => Promise<{ data: null; error: { message?: string; code?: string } | null }>
>(async () => ({ data: null, error: null }));
const client = { emailOtp: { requestPasswordReset: requestMock, resetPassword: resetMock } };

beforeEach(() => {
  withAuthApiClientMock.mockReset();
  requestMock.mockClear();
  resetMock.mockClear();
  withAuthApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run(client)
    })
  );
});

describe("activate actions", () => {
  it("sends a code and advances to the code step with the email carried forward", async () => {
    const result = await actions.request!(fakeAuthEvent({ email: "a@example.com" }));

    expect(requestMock).toHaveBeenCalledWith({ email: "a@example.com" });
    expect(result).toEqual({ step: "reset", email: "a@example.com" });
  });

  it("rejects a request without an email", async () => {
    const result = await actions.request!(fakeAuthEvent({}));

    expect(result).toMatchObject({ status: 400, data: { error: "Email is required." } });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("sets the new password with the code and redirects to login", async () => {
    await expect(
      actions.reset!(
        fakeAuthEvent({ email: "a@example.com", otp: "123456", password: "new-secret" })
      )
    ).rejects.toMatchObject({ status: 303, location: "/login?activated=true" });

    expect(resetMock).toHaveBeenCalledWith({
      email: "a@example.com",
      otp: "123456",
      password: "new-secret"
    });
  });

  it("keeps the code step after a failed reset so the entered code is not lost", async () => {
    resetMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_OTP", message: "invalid otp" }
    });

    const result = await actions.reset!(
      fakeAuthEvent({ email: "a@example.com", otp: "000000", password: "new-secret" })
    );

    expect(result).toMatchObject({
      status: 400,
      data: {
        step: "reset",
        email: "a@example.com",
        error: "That code isn't right. Check it and try again."
      }
    });
  });

  // SvelteKit rejects a route that exports both a "default" action and named
  // actions: every POST 500s, not just the one hitting default. The tests
  // above call actions.request/reset directly, so they'd never catch a
  // regression back to a "default" key without this shape check (see #228).
  it("does not mix a default action with named actions", () => {
    const keys = Object.keys(actions);

    expect(keys.length).toBeGreaterThan(1);
    expect(keys).not.toContain("default");
  });
});
