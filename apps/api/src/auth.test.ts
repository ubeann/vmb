import { beforeEach, describe, expect, it, vi } from "vitest";

const userStatusMock = vi.fn(async (_userId: string) => null as unknown);
const dbMock = { __brand: "db" };
const createDbMock = vi.fn((_databaseUrl: string) => dbMock);
const drizzleAdapterMock = vi.fn((_db: unknown, _config: unknown) => "adapter-result");
const betterAuthMock = vi.fn((_options: unknown) => ({ handler: vi.fn() }));
const emailOtpMock = vi.fn((_options: unknown) => ({ id: "email-otp" }));

vi.mock("@vmb/db", () => ({
  createDb: (databaseUrl: string) => createDbMock(databaseUrl),
  user: "user-table",
  session: "session-table",
  account: "account-table",
  verification: "verification-table"
}));

vi.mock("./master.js", () => ({
  masterStore: () => ({ getSignInEligibility: (userId: string) => userStatusMock(userId) })
}));

vi.mock("better-auth", () => ({
  betterAuth: (options: unknown) => betterAuthMock(options)
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: (db: unknown, config: unknown) => drizzleAdapterMock(db, config)
}));

vi.mock("better-auth/plugins/email-otp", () => ({
  emailOTP: (options: unknown) => emailOtpMock(options)
}));

const sendVerificationEmailMock = vi.fn();
const sendOtpEmailMock = vi.fn();

vi.mock("./email.js", () => ({
  sendVerificationEmail: (env: unknown, to: string, url: string) =>
    sendVerificationEmailMock(env, to, url),
  sendOtpEmail: (env: unknown, to: string, otp: string) => sendOtpEmailMock(env, to, otp)
}));

const env = {
  DATABASE_URL: "postgres://test",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:8787",
  WEB_URL: "http://localhost:5173",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "onboarding@resend.dev"
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("createAuth", () => {
  it("wires the drizzle adapter, enables email/password sign-in, and scopes trusted origins to the web app", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    expect(createDbMock).toHaveBeenCalledWith("postgres://test");
    expect(drizzleAdapterMock).toHaveBeenCalledWith(dbMock, {
      provider: "pg",
      schema: {
        user: "user-table",
        session: "session-table",
        account: "account-table",
        verification: "verification-table"
      }
    });
    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "secret",
        baseURL: "http://localhost:8787",
        trustedOrigins: ["http://localhost:5173"],
        emailAndPassword: expect.objectContaining({
          enabled: true,
          requireEmailVerification: true
        }),
        emailVerification: expect.objectContaining({
          sendOnSignUp: true,
          sendOnSignIn: true,
          autoSignInAfterVerification: false,
          sendVerificationEmail: expect.any(Function)
        })
      })
    );
  });

  it("sends the verification email through the configured provider when Better Auth calls sendVerificationEmail", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    const options = betterAuthMock.mock.calls[0]?.[0] as {
      emailVerification: {
        sendVerificationEmail: (data: { user: { email: string }; url: string }) => Promise<void>;
      };
    };

    await options.emailVerification.sendVerificationEmail({
      user: { email: "user@example.com" },
      url: "https://example.com/verify"
    });

    expect(sendVerificationEmailMock).toHaveBeenCalledWith(
      env,
      "user@example.com",
      "https://example.com/verify"
    );
  });

  it("hands background tasks, such as email sends, to the Worker's waitUntil (#232)", async () => {
    const { createAuth } = await import("./auth.js");
    const { waitUntil } = await import("cloudflare:workers");

    createAuth(env);

    const options = betterAuthMock.mock.calls[0]?.[0] as {
      advanced: { backgroundTasks: { handler: unknown } };
    };

    expect(options.advanced.backgroundTasks.handler).toBe(waitUntil);
  });

  it("reuses a single instance across calls, so in-memory rate-limit state survives across requests", async () => {
    const { createAuth } = await import("./auth.js");

    const first = createAuth(env);
    const second = createAuth(env);

    expect(second).toBe(first);
    expect(betterAuthMock).toHaveBeenCalledTimes(1);
  });

  it("disables public sign-up and installs the email-OTP plugin, also without sign-up", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    const options = betterAuthMock.mock.calls[0]?.[0] as {
      emailAndPassword: { disableSignUp?: boolean };
      plugins: unknown[];
    };

    expect(options.emailAndPassword.disableSignUp).toBe(true);
    expect(options.plugins).toEqual([expect.objectContaining({ id: "email-otp" })]);
    expect(emailOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({ disableSignUp: true, sendVerificationOTP: expect.any(Function) })
    );
  });

  it("sends the activation code through the configured provider when Better Auth asks for an OTP", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    const pluginOptions = emailOtpMock.mock.calls[0]?.[0] as {
      sendVerificationOTP: (data: { email: string; otp: string; type: string }) => Promise<void>;
    };

    await pluginOptions.sendVerificationOTP({
      email: "user@example.com",
      otp: "482913",
      type: "forget-password"
    });

    expect(sendOtpEmailMock).toHaveBeenCalledWith(env, "user@example.com", "482913");
  });

  it("gates every session on the business record: missing and soft-deleted rows are rejected", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    const options = betterAuthMock.mock.calls[0]?.[0] as {
      databaseHooks: {
        session: { create: { before: (session: { userId: string }) => Promise<void> } };
      };
    };
    const before = options.databaseHooks.session.create.before;

    userStatusMock.mockResolvedValueOnce(null);
    await expect(before({ userId: "user-1" })).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: "ACCOUNT_UNAVAILABLE" }
    });

    userStatusMock.mockResolvedValueOnce({ deletedAt: "2026-09-01T00:00:00.000Z" });
    await expect(before({ userId: "user-1" })).rejects.toMatchObject({ status: "FORBIDDEN" });

    userStatusMock.mockResolvedValueOnce({ deletedAt: null });
    await expect(before({ userId: "user-1" })).resolves.toBeUndefined();
  });
});
