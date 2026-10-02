import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();

vi.mock("$lib/auth-action.js", () => import("../../../lib/auth-action.js"));

vi.mock("../../../lib/api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { actions } = await import("./+page.server.js");
const { fakeAuthEvent } = await import("../../../lib/test-support.js");

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

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: "Enter your email" } }
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email on the request step", async () => {
    const result = await actions.request!(fakeAuthEvent({ email: "a@" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: "Enter a valid email, like name@company.com" } }
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("shows Better Auth's INVALID_EMAIL on the email field", async () => {
    requestMock.mockResolvedValueOnce({
      data: null,
      error: { code: "INVALID_EMAIL", message: "Invalid email" } as never
    });

    const result = await actions.request!(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: "Enter a valid email, like name@company.com" } }
    });
  });

  it("keeps rate limiting on the request step, with the 429 copy", async () => {
    requestMock.mockResolvedValueOnce({
      data: null,
      error: { status: 429, message: "Too many requests" } as never
    });

    const result = await actions.request!(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Too many attempts. Wait a moment and try again." }
    });
  });

  // The API gives every email the same reply (#232), so the only difference
  // this step could ever show is one it adds itself. It adds none.
  it("gives the same reply for every email, naming only the email typed", async () => {
    const replies = [
      await actions.request!(fakeAuthEvent({ email: "staff@vmblogistics.id" })),
      await actions.request!(fakeAuthEvent({ email: "nobody@vmblogistics.id" }))
    ];

    expect(replies).toEqual([
      { step: "reset", email: "staff@vmblogistics.id" },
      { step: "reset", email: "nobody@vmblogistics.id" }
    ]);
  });

  it('sends a new code from the code step and stays on it, for "Send a new code"', async () => {
    const result = await actions.resend!(fakeAuthEvent({ email: "a@example.com" }));

    expect(requestMock).toHaveBeenCalledWith({ email: "a@example.com" });
    expect(result).toEqual({ step: "reset", email: "a@example.com" });
  });

  // The code step stays, so the entered code and email are kept and the banner
  // shows where the user pressed "Send a new code" (#251).
  it("keeps rate limiting on the code step, with the 429 copy", async () => {
    requestMock.mockResolvedValueOnce({
      data: null,
      error: { status: 429, message: "Too many requests" } as never
    });

    const result = await actions.resend!(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: {
        step: "reset",
        email: "a@example.com",
        error: "Too many attempts. Wait a moment and try again."
      }
    });
  });

  it("keeps the code step when the hidden email is missing on a resend", async () => {
    const result = await actions.resend!(fakeAuthEvent({}));

    expect(result).toMatchObject({
      status: 400,
      data: {
        step: "reset",
        email: "",
        error: "Reload this page, enter your email, and request a new code",
        fieldErrors: { email: "Enter your email" }
      }
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it.each([
    ["", "Enter the code from your email"],
    ["12345", "Enter the 6-digit code from your email"],
    ["1234567", "Enter the 6-digit code from your email"],
    ["12a456", "Enter the 6-digit code from your email"]
  ])("rejects the code %j on the code step", async (otp, message) => {
    const result = await actions.reset!(
      fakeAuthEvent({ email: "a@example.com", otp, password: "new-secret" })
    );

    expect(result).toMatchObject({
      status: 400,
      data: { step: "reset", email: "a@example.com", fieldErrors: { otp: message } }
    });
    expect(resetMock).not.toHaveBeenCalled();
  });

  it.each([
    ["", "Enter a new password"],
    ["short", "Use at least 8 characters"],
    ["x".repeat(129), "Use 128 characters or fewer"]
  ])("rejects the new password %#: %s", async (password, message) => {
    const result = await actions.reset!(
      fakeAuthEvent({ email: "a@example.com", otp: "123456", password })
    );

    expect(result).toMatchObject({ status: 400, data: { fieldErrors: { password: message } } });
    expect(resetMock).not.toHaveBeenCalled();
  });

  it.each(["x".repeat(8), "x".repeat(128)])(
    "accepts a new password at the length bounds (%#)",
    async (password) => {
      await expect(
        actions.reset!(fakeAuthEvent({ email: "a@example.com", otp: "123456", password }))
      ).rejects.toMatchObject({ status: 303 });
    }
  );

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
