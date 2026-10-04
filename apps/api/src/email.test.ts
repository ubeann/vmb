import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const resendConstructorMock = vi.fn((apiKey?: string) => apiKey);

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => sendMock(...args) };
    constructor(apiKey?: string) {
      resendConstructorMock(apiKey);
    }
  }
}));

const { sendOtpEmail, sendVerificationEmail } = await import("./email.js");

const env = {
  DATABASE_URL: "postgres://test",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:8787",
  WEB_URL: "http://localhost:5173",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "onboarding@resend.dev"
};

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("sendVerificationEmail", () => {
  it("sends via Resend when EMAIL_TRANSPORT is unset, using the configured from address and the verification url", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "email_1" }, error: null });

    await sendVerificationEmail(
      env,
      "user@example.com",
      "https://vmb-api.example.com/api/auth/verify-email?token=abc"
    );

    expect(resendConstructorMock).toHaveBeenCalledWith("re_test");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "onboarding@resend.dev",
        to: "user@example.com",
        subject: expect.any(String),
        html: expect.stringContaining("https://vmb-api.example.com/api/auth/verify-email?token=abc")
      }),
      { idempotencyKey: expect.any(String) }
    );
    const html = sendMock.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain('style="');
    expect(html).toContain("Verify email address");
  });

  it.each(["log", "quiet"])(
    "logs the email and never reaches Resend when EMAIL_TRANSPORT is %s",
    async (transport) => {
      const previewEnv = { ...env, EMAIL_TRANSPORT: transport };

      await sendVerificationEmail(
        previewEnv,
        "user@example.com",
        "https://vmb-api.example.com/api/auth/verify-email?token=abc"
      );

      expect(resendConstructorMock).not.toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        `EMAIL_TRANSPORT=${transport}: suppressed outbound email`,
        expect.objectContaining({
          from: "onboarding@resend.dev",
          to: "user@example.com",
          subject: "Verify your email — VMB",
          html: expect.stringContaining(
            "https://vmb-api.example.com/api/auth/verify-email?token=abc"
          )
        })
      );
    }
  );

  it("throws with the Resend error message when the send fails", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid from address", statusCode: 422, name: "validation_error" }
    });

    await expect(
      sendVerificationEmail(env, "user@example.com", "https://example.com/verify")
    ).rejects.toThrow("Invalid from address");
  });

  it("escapes a verification URL in both the link and its visible text", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "email_3" }, error: null });

    await sendVerificationEmail(env, "user@example.com", "https://example.com/verify?a=1&b=2");

    const html = sendMock.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain("https://example.com/verify?a=1&amp;b=2");
    expect(html).not.toContain("?a=1&b=2");
  });
});

describe("sendEmail retries", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendMock.mockReset();
    vi.useFakeTimers();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  const serverError = {
    data: null,
    error: { message: "Internal server error", statusCode: 500, name: "internal_server_error" }
  };

  it("retries a failure Resend may recover from, with one idempotency key across tries", async () => {
    sendMock
      .mockResolvedValueOnce(serverError)
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Unable to fetch data", statusCode: null, name: "application_error" }
      })
      .mockResolvedValueOnce({ data: { id: "email_4" }, error: null });

    const sending = sendOtpEmail(env, "user@example.com", "482913");
    await vi.runAllTimersAsync();
    await sending;

    expect(sendMock).toHaveBeenCalledTimes(3);
    const keys = sendMock.mock.calls.map((call) => call[1]?.idempotencyKey);
    expect(keys[0]).toEqual(expect.any(String));
    expect(new Set(keys).size).toBe(1);
  });

  it("gives a send that never answers a timeout, then retries it", async () => {
    sendMock
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce({ data: { id: "email_5" }, error: null });

    const sending = sendOtpEmail(env, "user@example.com", "482913");
    await vi.runAllTimersAsync();
    await sending;

    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after three failed tries", async () => {
    sendMock.mockResolvedValue(serverError);

    const sending = sendOtpEmail(env, "user@example.com", "482913");
    const outcome = expect(sending).rejects.toThrow("Internal server error");
    await vi.runAllTimersAsync();
    await outcome;

    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["validation_error", 422],
    ["daily_quota_exceeded", 429],
    ["invalid_api_key", 403],
    ["application_error", 413]
  ])("does not retry %s (%i), which another try cannot fix", async (name, statusCode) => {
    sendMock.mockResolvedValue({ data: null, error: { message: name, statusCode, name } });

    const sending = sendOtpEmail(env, "user@example.com", "482913");
    const outcome = expect(sending).rejects.toThrow(name);
    await vi.runAllTimersAsync();
    await outcome;

    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendOtpEmail", () => {
  it("sends the one-time code via Resend with actionable copy", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "email_2" }, error: null });

    await sendOtpEmail(env, "user@example.com", "482913");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "onboarding@resend.dev",
        to: "user@example.com",
        subject: "Your VMB password code",
        html: expect.stringContaining("482913")
      }),
      { idempotencyKey: expect.any(String) }
    );
    const html = sendMock.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain('style="');
    expect(html).toContain("482913");
    expect(html).toMatch(/first time|reset your password/i);
  });

  it("logs and never reaches Resend when EMAIL_TRANSPORT is set", async () => {
    const previewEnv = { ...env, EMAIL_TRANSPORT: "log" };

    await sendOtpEmail(previewEnv, "user@example.com", "482913");

    expect(resendConstructorMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "EMAIL_TRANSPORT=log: suppressed outbound email",
      expect.objectContaining({ to: "user@example.com", subject: "Your VMB password code" })
    );
  });
});
