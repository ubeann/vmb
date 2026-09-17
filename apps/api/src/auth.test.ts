import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = { __brand: "db" };
const createDbMock = vi.fn((_databaseUrl: string) => dbMock);
const drizzleAdapterMock = vi.fn((_db: unknown, _config: unknown) => "adapter-result");
const betterAuthMock = vi.fn((_options: unknown) => ({ handler: vi.fn() }));

vi.mock("@vmb/db", () => ({
  createDb: (databaseUrl: string) => createDbMock(databaseUrl),
  user: "user-table",
  session: "session-table",
  account: "account-table",
  verification: "verification-table"
}));

vi.mock("better-auth", () => ({
  betterAuth: (options: unknown) => betterAuthMock(options)
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: (db: unknown, config: unknown) => drizzleAdapterMock(db, config)
}));

const sendVerificationEmailMock = vi.fn();

vi.mock("./email.js", () => ({
  sendVerificationEmail: (env: unknown, to: string, url: string) =>
    sendVerificationEmailMock(env, to, url)
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

  it("reuses a single instance across calls, so in-memory rate-limit state survives across requests", async () => {
    const { createAuth } = await import("./auth.js");

    const first = createAuth(env);
    const second = createAuth(env);

    expect(second).toBe(first);
    expect(betterAuthMock).toHaveBeenCalledTimes(1);
  });
});
