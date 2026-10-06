import { CLIENT_IP_HEADER } from "@vmb/types";
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
  verification: "verification-table",
  rateLimit: "rate-limit-table"
}));

vi.mock("./master.js", () => ({
  masterStore: () => ({ getSignInEligibility: (userId: string) => userStatusMock(userId) })
}));

vi.mock("./code-request-limit.js", () => ({
  CODE_REQUEST_PATH: "/email-otp/request-password-reset",
  codeRequestLimit: () => ({ id: "code-request-limit" })
}));

vi.mock("better-auth", () => ({
  betterAuth: (options: unknown) => betterAuthMock(options)
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: (db: unknown, config: unknown) => drizzleAdapterMock(db, config)
}));

vi.mock("better-auth/plugins/email-otp", async (importOriginal) => {
  const original = await importOriginal<typeof import("better-auth/plugins/email-otp")>();
  return {
    emailOTP: (options: Parameters<typeof original.emailOTP>[0]) => {
      emailOtpMock(options);
      return original.emailOTP(options);
    }
  };
});

const sessionEmailMock = vi.fn(async () => ({ user: { email: "signed.in@vmblogistics.id" } }));

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getSessionFromCtx: () => sessionEmailMock()
}));

const isPasswordBreachedMock = vi.fn(async (_password: string) => false);

vi.mock("./breached-password.js", () => ({
  isPasswordBreached: (password: string) => isPasswordBreachedMock(password)
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
        verification: "verification-table",
        rateLimit: "rate-limit-table"
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

  it("sets Better Auth's password bounds to the shared 12 to 128 rule (#256)", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    expect(betterAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: expect.objectContaining({ minPasswordLength: 12, maxPasswordLength: 128 })
      })
    );
  });

  describe("the breached-password hook (#256)", () => {
    const password = "a long and unusual passphrase";

    async function runBefore(path: string, body: unknown) {
      const { createAuth } = await import("./auth.js");
      createAuth(env);
      const options = betterAuthMock.mock.calls[0]?.[0] as {
        hooks: { before: (ctx: unknown) => Promise<unknown> };
      };
      return options.hooks.before({ path, body, context: {} });
    }

    it("refuses a breached password on reset-password, with its own code", async () => {
      isPasswordBreachedMock.mockResolvedValueOnce(true);

      await expect(runBefore("/email-otp/reset-password", { password })).rejects.toMatchObject({
        status: "BAD_REQUEST",
        body: { code: "PASSWORD_BREACHED" }
      });
      expect(isPasswordBreachedMock).toHaveBeenCalledWith(password);
    });

    it("refuses a password built from the email name or VMB, before any lookup", async () => {
      const email = "rina.wijaya@vmblogistics.id";

      await expect(
        runBefore("/email-otp/reset-password", { email, password: "my-Rina.Wijaya-is-long" })
      ).rejects.toMatchObject({
        status: "BAD_REQUEST",
        body: { code: "PASSWORD_CONTAINS_CONTEXT" }
      });
      await expect(
        runBefore("/email-otp/reset-password", { email, password: "the VMB warehouse crate" })
      ).rejects.toMatchObject({ body: { code: "PASSWORD_CONTAINS_CONTEXT" } });
      expect(isPasswordBreachedMock).not.toHaveBeenCalled();
    });

    it("lets a password through that is not breached", async () => {
      await expect(runBefore("/email-otp/reset-password", { password })).resolves.toBeUndefined();
    });

    it("does not look up a password of a length Better Auth refuses itself", async () => {
      await runBefore("/email-otp/reset-password", { password: "short" });
      await runBefore("/email-otp/reset-password", { password: "x".repeat(129) });

      expect(isPasswordBreachedMock).not.toHaveBeenCalled();
    });

    it("covers the other endpoints that set a password, by their own field (#256)", async () => {
      isPasswordBreachedMock.mockResolvedValue(true);

      for (const path of ["/change-password", "/reset-password"]) {
        await expect(runBefore(path, { newPassword: password })).rejects.toMatchObject({
          body: { code: "PASSWORD_BREACHED" }
        });
      }
      // Not the field of another endpoint.
      await expect(
        runBefore("/change-password", { password, newPassword: "short" })
      ).resolves.toBeUndefined();
    });

    it("refuses a changed password built from the signed-in user's own email name", async () => {
      await expect(
        runBefore("/change-password", { newPassword: "my signed.in passphrase" })
      ).rejects.toMatchObject({ body: { code: "PASSWORD_CONTAINS_CONTEXT" } });
      expect(isPasswordBreachedMock).not.toHaveBeenCalled();
    });

    it("leaves every other endpoint alone", async () => {
      isPasswordBreachedMock.mockResolvedValue(true);

      await expect(runBefore("/sign-in/email", { password })).resolves.toBeUndefined();
      expect(isPasswordBreachedMock).not.toHaveBeenCalled();
    });
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

  // The auth route sets this header to the address it trusts (#250), so it is
  // the only one Better Auth may read: any other, such as `x-forwarded-for`,
  // a caller could set to anything.
  it("reads the client IP only from the header the auth route vouches for", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    const options = betterAuthMock.mock.calls[0]?.[0] as {
      advanced: { ipAddress: { ipAddressHeaders: string[] } };
    };

    expect(options.advanced.ipAddress.ipAddressHeaders).toEqual([CLIENT_IP_HEADER]);
  });

  // Better Auth turns limits on only when NODE_ENV is "production", which the
  // Worker never sets, and keeps counts per isolate unless told otherwise
  // (ADR-0042). Reading the session is exempt, so it costs no extra query.
  it("turns rate limits on, counts them in the database, and exempts reading the session", async () => {
    const { createAuth } = await import("./auth.js");

    createAuth(env);

    const options = betterAuthMock.mock.calls[0]?.[0] as { rateLimit: unknown };

    expect(options.rateLimit).toEqual({
      enabled: true,
      storage: "database",
      customRules: {
        "/get-session": false,
        "/email-otp/request-password-reset": { window: 60, max: 3 }
      }
    });
  });

  it("reuses a single instance across calls, so Better Auth's per-instance state survives across requests", async () => {
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
    expect(options.plugins).toEqual([
      expect.objectContaining({ id: "code-request-limit" }),
      expect.objectContaining({ id: "email-otp" })
    ]);
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

    userStatusMock.mockResolvedValueOnce({ deletedAt: null, status: "active" });
    await expect(before({ userId: "user-1" })).resolves.toBeUndefined();
  });
});
