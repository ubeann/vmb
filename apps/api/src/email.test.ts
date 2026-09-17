import { describe, expect, it, vi } from "vitest";

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

const { sendVerificationEmail } = await import("./email.js");

const env = {
  DATABASE_URL: "postgres://test",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:8787",
  WEB_URL: "http://localhost:5173",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "onboarding@resend.dev"
};

describe("sendVerificationEmail", () => {
  it("sends via Resend using the configured from address and the verification url", async () => {
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
      })
    );
  });

  it("throws with the Resend error message when the send fails", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid from address", statusCode: 422, name: "validation_error" }
    });

    await expect(
      sendVerificationEmail(env, "user@example.com", "https://example.com/verify")
    ).rejects.toThrow("Invalid from address");
  });
});
