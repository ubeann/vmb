import { beforeEach, describe, expect, it, vi } from "vitest";

const withAuthApiClientMock = vi.fn();

vi.mock("$lib/auth-action.js", () => import("../../../lib/auth-action.js"));
vi.mock("$lib/server/checked-code.js", () => import("../../../lib/server/checked-code.js"));
vi.mock("$lib/server/sent-code.js", () => import("../../../lib/server/sent-code.js"));

vi.mock("../../../lib/api-access.js", () => ({
  withAuthApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withAuthApiClientMock(event, run)
}));

const { actions, load } = await import("./+page.server.js");
const { fakeAuthEvent, fakeCookies } = await import("../../../lib/test-support.js");
const { keepCheckedCode, readCheckedCode } = await import("../../../lib/server/checked-code.js");
const { keepSentCode, readSentCode } = await import("../../../lib/server/sent-code.js");

type AuthReply = { data: null; error: { message?: string; code?: string; status?: number } | null };
const ok = async (): Promise<AuthReply> => ({ data: null, error: null });

const requestMock = vi.fn<() => Promise<AuthReply>>(ok);
const checkMock = vi.fn<() => Promise<AuthReply>>(ok);
const resetMock = vi.fn<() => Promise<AuthReply>>(ok);
const client = {
  emailOtp: {
    requestPasswordReset: requestMock,
    checkVerificationOtp: checkMock,
    resetPassword: resetMock
  }
};

const refusal = (code: string) => ({ data: null, error: { code, message: code } });

// A cookie jar holding a code Verify has checked.
function checkedJar(checked = { email: "a@example.com", otp: "123456" }) {
  const cookies = fakeCookies();
  keepCheckedCode({ cookies, url: new URL("https://vmb.example/activate") }, checked);
  return cookies;
}

// A cookie jar holding a code that was sent a moment ago, as a reload sees it.
function sentJar(email = "a@example.com", sentAt = Date.now()) {
  const cookies = fakeCookies();
  keepSentCode({ cookies, url: new URL("https://vmb.example/activate") }, email, sentAt);
  return cookies;
}

beforeEach(() => {
  withAuthApiClientMock.mockReset();
  for (const mock of [requestMock, checkMock, resetMock]) mock.mockReset().mockImplementation(ok);
  withAuthApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run(client)
    })
  );
});

describe("activate load", () => {
  const loadWith = (cookies = fakeCookies(), user: unknown = null) =>
    load({ locals: { user }, cookies } as never);

  it("sends a signed-in user home", () => {
    expect(() => loadWith(fakeCookies(), { id: "u1" })).toThrow(
      expect.objectContaining({ status: 303, location: "/" })
    );
  });

  it("starts on the email step without a checked code", () => {
    expect(loadWith()).toEqual({});
  });

  // A reload keeps the password step, and the page gets the email but never
  // the code.
  it("picks the password step from a checked code, handing the page only its email", () => {
    expect(loadWith(checkedJar())).toEqual({ step: "password", email: "a@example.com" });
  });

  // A reload keeps the code step too, with the time left before "Send a new
  // code" is back (#255).
  it("picks the code step from a code sent a moment ago, with the time left to wait", () => {
    const sentAt = Date.now() - 18_000;

    expect(loadWith(sentJar("a@example.com", sentAt))).toEqual({
      step: "code",
      email: "a@example.com",
      resendIn: 42,
      sentAt
    });
  });

  it("has nothing left to wait for once the minute is up", () => {
    const sentAt = Date.now() - 61_000;

    expect(loadWith(sentJar("a@example.com", sentAt))).toMatchObject({ step: "code", resendIn: 0 });
  });

  it("starts on the email step once the code itself has expired", () => {
    const sentAt = Date.now() - 301_000;

    expect(loadWith(sentJar("a@example.com", sentAt))).toEqual({});
  });

  it("prefers the password step when a code has been checked as well", () => {
    const cookies = checkedJar();
    keepSentCode({ cookies, url: new URL("https://vmb.example/activate") }, "a@example.com");

    expect(loadWith(cookies)).toEqual({ step: "password", email: "a@example.com" });
  });
});

describe("activate request", () => {
  it("sends a code and advances to the code step with the email carried forward", async () => {
    const result = await actions.request!(fakeAuthEvent({ email: "a@example.com" }));

    expect(requestMock).toHaveBeenCalledWith({ email: "a@example.com" });
    expect(result).toEqual({ step: "code", email: "a@example.com" });
  });

  it("keeps when the code was sent, for the resend countdown", async () => {
    const cookies = fakeCookies();

    await actions.request!(fakeAuthEvent({ email: "a@example.com" }, { cookies }));

    expect(readSentCode(cookies)).toMatchObject({ email: "a@example.com", resendIn: 60 });
  });

  it("forgets a code sent earlier when the new request fails", async () => {
    requestMock.mockResolvedValueOnce({ data: null, error: { status: 429 } });
    const cookies = sentJar();

    await actions.request!(fakeAuthEvent({ email: "b@example.com" }, { cookies }));

    expect(readSentCode(cookies)).toBeUndefined();
  });

  it("starts over, dropping a code checked earlier", async () => {
    const cookies = checkedJar();

    await actions.request!(fakeAuthEvent({ email: "b@example.com" }, { cookies }));

    expect(readCheckedCode(cookies)).toBeUndefined();
  });

  // A refused email still leaves the password step behind: otherwise the
  // load would pick it again from the code checked earlier.
  it("starts over even when the email is refused before it is sent", async () => {
    const cookies = checkedJar();

    await actions.request!(fakeAuthEvent({ email: "" }, { cookies }));

    expect(readCheckedCode(cookies)).toBeUndefined();
  });

  it("rejects a request without an email", async () => {
    const result = await actions.request!(fakeAuthEvent({}));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: "Enter your email" } }
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const result = await actions.request!(fakeAuthEvent({ email: "a@" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: "Enter a valid email, like name@example.com" } }
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("shows Better Auth's INVALID_EMAIL on the email field", async () => {
    requestMock.mockResolvedValueOnce(refusal("INVALID_EMAIL"));

    const result = await actions.request!(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: { fieldErrors: { email: "Enter a valid email, like name@example.com" } }
    });
  });

  it("keeps rate limiting on the email step, with the 429 copy", async () => {
    requestMock.mockResolvedValueOnce({ data: null, error: { status: 429 } });

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
      { step: "code", email: "staff@vmblogistics.id" },
      { step: "code", email: "nobody@vmblogistics.id" }
    ]);
  });
});

describe('activate resend ("Send a new code")', () => {
  it("sends a new code and stays on the code step", async () => {
    const result = await actions.resend!(fakeAuthEvent({ email: "a@example.com" }));

    expect(requestMock).toHaveBeenCalledWith({ email: "a@example.com" });
    expect(result).toEqual({ step: "code", email: "a@example.com" });
  });

  // The banner shows where the user pressed "Send a new code" (#251).
  it("keeps rate limiting on the code step, with the 429 copy", async () => {
    requestMock.mockResolvedValueOnce({ data: null, error: { status: 429 } });

    const result = await actions.resend!(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toMatchObject({
      status: 400,
      data: {
        step: "code",
        email: "a@example.com",
        error: "Too many attempts. Wait a moment and try again."
      }
    });
  });

  it("keeps the code step when the hidden email is missing", async () => {
    const result = await actions.resend!(fakeAuthEvent({}));

    expect(result).toMatchObject({
      status: 400,
      data: {
        step: "code",
        email: "",
        error: "Reload this page, enter your email, and request a new code",
        fieldErrors: { email: "Enter your email" }
      }
    });
    expect(requestMock).not.toHaveBeenCalled();
  });
});

describe("the resend countdown's send time (#255)", () => {
  it("is renewed by a new code, so the minute starts again", async () => {
    const cookies = sentJar("a@example.com", Date.now() - 50_000);

    await actions.resend!(fakeAuthEvent({ email: "a@example.com" }, { cookies }));

    expect(readSentCode(cookies)).toMatchObject({ email: "a@example.com", resendIn: 60 });
  });

  // No code went out, so the minute that was running still is.
  it("is kept when a new code is turned down", async () => {
    requestMock.mockResolvedValueOnce({ data: null, error: { status: 429 } });
    const cookies = sentJar("a@example.com", Date.now() - 50_000);

    await actions.resend!(fakeAuthEvent({ email: "a@example.com" }, { cookies }));

    expect(readSentCode(cookies)).toMatchObject({ email: "a@example.com", resendIn: 10 });
  });

  it("is the same for a registered and an unregistered email (#232)", async () => {
    const registered = fakeCookies();
    const unregistered = fakeCookies();

    await actions.request!(
      fakeAuthEvent({ email: "staff@vmblogistics.id" }, { cookies: registered })
    );
    await actions.request!(
      fakeAuthEvent({ email: "nobody@vmblogistics.id" }, { cookies: unregistered })
    );

    expect(readSentCode(registered)?.resendIn).toBe(readSentCode(unregistered)?.resendIn);
  });

  it("outlasts Verify, so a refused code leaves the countdown running", async () => {
    checkMock.mockResolvedValueOnce(refusal("INVALID_OTP"));
    const cookies = sentJar();

    await actions.verify!(fakeAuthEvent({ email: "a@example.com", otp: "000000" }, { cookies }));

    expect(readSentCode(cookies)).toBeDefined();
  });

  it("is dropped with the password set, and when the user starts over", async () => {
    const reset = checkedJar();
    keepSentCode({ cookies: reset, url: new URL("https://vmb.example/activate") }, "a@example.com");
    await expect(
      actions.reset!(fakeAuthEvent({ password: "new-secret" }, { cookies: reset }))
    ).rejects.toMatchObject({ status: 303 });
    const restarted = sentJar();
    await actions.restart!(fakeAuthEvent({}, { cookies: restarted }));

    expect(readSentCode(reset)).toBeUndefined();
    expect(readSentCode(restarted)).toBeUndefined();
  });
});

describe("activate verify (the code step)", () => {
  it.each([
    ["", "Enter the code from your email"],
    ["12345", "Enter the 6-digit code from your email"],
    ["1234567", "Enter the 6-digit code from your email"],
    ["12a456", "Enter the 6-digit code from your email"]
  ])("rejects the code %j", async (otp, message) => {
    const result = await actions.verify!(fakeAuthEvent({ email: "a@example.com", otp }));

    expect(result).toMatchObject({
      status: 400,
      data: { step: "code", email: "a@example.com", fieldErrors: { otp: message } }
    });
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("checks the code as a password-reset code, without using it up", async () => {
    await actions.verify!(fakeAuthEvent({ email: "a@example.com", otp: "123456" }));

    expect(checkMock).toHaveBeenCalledWith({
      email: "a@example.com",
      otp: "123456",
      type: "forget-password"
    });
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("keeps a checked code for the password step and moves to it", async () => {
    const cookies = fakeCookies();

    const result = await actions.verify!(
      fakeAuthEvent({ email: "a@example.com", otp: "123456" }, { cookies })
    );

    expect(result).toEqual({ step: "password", email: "a@example.com" });
    expect(readCheckedCode(cookies)).toEqual({ email: "a@example.com", otp: "123456" });
  });

  it.each([
    ["INVALID_OTP", "That code isn't right. Enter it again."],
    ["OTP_EXPIRED", "This code expired. Send a new one."],
    ["TOO_MANY_ATTEMPTS", "Too many attempts. Send a new code and try again."]
  ])("stays on the code step for %s, with its copy under the boxes", async (code, copy) => {
    checkMock.mockResolvedValueOnce(refusal(code));
    const cookies = fakeCookies();

    const result = await actions.verify!(
      fakeAuthEvent({ email: "a@example.com", otp: "000000" }, { cookies })
    );

    expect(result).toMatchObject({
      status: 400,
      data: { step: "code", email: "a@example.com", errorAt: "code", error: copy }
    });
    expect(readCheckedCode(cookies)).toBeUndefined();
  });

  // An unregistered email has no code to check, so Better Auth answers
  // INVALID_OTP, as it does a wrong code (apps/api's activate-reply test).
  // This step must add no difference of its own (#232).
  it("gives an unregistered email exactly the reply a wrong code gets", async () => {
    checkMock.mockResolvedValue(refusal("INVALID_OTP"));

    const registered = await actions.verify!(
      fakeAuthEvent({ email: "staff@vmblogistics.id", otp: "000000" })
    );
    const unregistered = await actions.verify!(
      fakeAuthEvent({ email: "nobody@vmblogistics.id", otp: "000000" })
    );

    expect(unregistered).toEqual({
      ...(registered as object),
      data: { ...(registered as { data: object }).data, email: "nobody@vmblogistics.id" }
    });
  });

  it("keeps rate limiting on the code step, with the 429 copy", async () => {
    checkMock.mockResolvedValueOnce({ data: null, error: { status: 429 } });

    const result = await actions.verify!(fakeAuthEvent({ email: "a@example.com", otp: "123456" }));

    expect(result).toMatchObject({
      status: 400,
      data: { step: "code", error: "Too many attempts. Wait a moment and try again." }
    });
  });
});

describe("activate reset (the password step)", () => {
  it("sends the checked code's email and code with the new password, then goes to log in", async () => {
    const cookies = checkedJar();

    await expect(
      actions.reset!(fakeAuthEvent({ password: "new-secret" }, { cookies }))
    ).rejects.toMatchObject({ status: 303, location: "/login?activated=true" });

    expect(resetMock).toHaveBeenCalledWith({
      email: "a@example.com",
      otp: "123456",
      password: "new-secret"
    });
    expect(readCheckedCode(cookies)).toBeUndefined();
  });

  it("takes the email and code from the checked code, never from the form", async () => {
    const cookies = checkedJar();

    await expect(
      actions.reset!(
        fakeAuthEvent(
          { email: "other@example.com", otp: "999999", password: "new-secret" },
          { cookies }
        )
      )
    ).rejects.toMatchObject({ status: 303 });

    expect(resetMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@example.com", otp: "123456" })
    );
  });

  it("is out of reach without a checked code, sending the user back to the email step", async () => {
    const result = await actions.reset!(fakeAuthEvent({ password: "new-secret" }));

    expect(result).toMatchObject({
      status: 400,
      data: { step: "request", error: "Your code expired. Enter your email to get a new one." }
    });
    expect(resetMock).not.toHaveBeenCalled();
  });

  it.each([
    ["", "Enter a new password"],
    ["short", "Use at least 8 characters"],
    ["x".repeat(129), "Use 128 characters or fewer"]
  ])("rejects the new password %#: %s", async (password, message) => {
    const result = await actions.reset!(fakeAuthEvent({ password }, { cookies: checkedJar() }));

    expect(result).toMatchObject({
      status: 400,
      data: { step: "password", email: "a@example.com", fieldErrors: { password: message } }
    });
    expect(resetMock).not.toHaveBeenCalled();
  });

  it.each(["x".repeat(8), "x".repeat(128)])(
    "accepts a new password at the length bounds (%#)",
    async (password) => {
      await expect(
        actions.reset!(fakeAuthEvent({ password }, { cookies: checkedJar() }))
      ).rejects.toMatchObject({ status: 303 });
    }
  );

  it.each([
    ["OTP_EXPIRED", "This code expired. Send a new one."],
    ["TOO_MANY_ATTEMPTS", "Too many attempts. Send a new code and try again."],
    ["INVALID_OTP", "That code isn't right. Enter it again."]
  ])("goes back to the code step for %s, with the email kept and its copy", async (code, copy) => {
    resetMock.mockResolvedValueOnce(refusal(code));
    const cookies = checkedJar();

    const result = await actions.reset!(fakeAuthEvent({ password: "new-secret" }, { cookies }));

    expect(result).toMatchObject({
      status: 400,
      data: { step: "code", email: "a@example.com", errorAt: "code", error: copy }
    });
    expect(readCheckedCode(cookies)).toBeUndefined();
  });

  it("stays on the password step for a rate limit, keeping the checked code", async () => {
    resetMock.mockResolvedValueOnce({ data: null, error: { status: 429 } });
    const cookies = checkedJar();

    const result = await actions.reset!(fakeAuthEvent({ password: "new-secret" }, { cookies }));

    expect(result).toMatchObject({
      status: 400,
      data: {
        step: "password",
        email: "a@example.com",
        error: "Too many attempts. Wait a moment and try again."
      }
    });
    expect(readCheckedCode(cookies)).toBeDefined();
  });
});

describe('activate restart ("Use a different email")', () => {
  it("drops the checked code and returns to the email step with the email to fix", async () => {
    const cookies = checkedJar();

    const result = await actions.restart!(fakeAuthEvent({}, { cookies }));

    expect(result).toEqual({ step: "request", email: "a@example.com" });
    expect(readCheckedCode(cookies)).toBeUndefined();
  });

  // On the code step, with nothing checked yet, the email is the one the code
  // was sent to.
  it("returns from the code step to the email step with the email the code was sent to", async () => {
    const cookies = sentJar("a@example.com");

    const result = await actions.restart!(fakeAuthEvent({}, { cookies }));

    expect(result).toEqual({ step: "request", email: "a@example.com" });
    expect(readSentCode(cookies)).toBeUndefined();
  });

  // The cookies last as long as the code does; a page left open longer still
  // knows the email, and posts it with the form.
  it("keeps the email the page posts once both cookies have gone", async () => {
    const result = await actions.restart!(fakeAuthEvent({ email: "a@example.com" }));

    expect(result).toEqual({ step: "request", email: "a@example.com" });
  });

  it("prefers the email the code was sent to over the one posted", async () => {
    const result = await actions.restart!(
      fakeAuthEvent({ email: "other@example.com" }, { cookies: sentJar("a@example.com") })
    );

    expect(result).toEqual({ step: "request", email: "a@example.com" });
  });

  it("does not put a malformed posted email in the field", async () => {
    const result = await actions.restart!(fakeAuthEvent({ email: "<b>x" }));

    expect(result).toEqual({ step: "request", email: "" });
  });

  it("returns to an empty email step when the checked code has already gone", async () => {
    const result = await actions.restart!(fakeAuthEvent({}));

    expect(result).toEqual({ step: "request", email: "" });
  });
});

// SvelteKit rejects a route that exports both a "default" action and named
// actions: every POST 500s, not just the one hitting default. The tests above
// call the named actions directly, so they'd never catch a regression back to
// a "default" key without this shape check (see #228).
it("does not mix a default action with named actions", () => {
  const keys = Object.keys(actions);

  expect(keys.length).toBeGreaterThan(1);
  expect(keys).not.toContain("default");
});
