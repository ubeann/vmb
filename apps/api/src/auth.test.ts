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

const env = {
  DATABASE_URL: "postgres://test",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:8787",
  WEB_URL: "http://localhost:5173"
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
        emailAndPassword: expect.objectContaining({ enabled: true })
      })
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
