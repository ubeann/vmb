import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The activate request step (#232) through the real Better Auth handler, on an
// in-memory database: a reply must not tell a registered email from an
// unregistered one, by its body or by how long it takes.
const memoryDb = vi.hoisted(
  () =>
    ({ user: [], session: [], account: [], verification: [] }) as Record<
      string,
      Record<string, unknown>[]
    >
);
const backgroundTasks = vi.hoisted(() => [] as Promise<unknown>[]);
const sendOtpEmailMock = vi.hoisted(() =>
  vi.fn(async (_env: unknown, _to: string, _otp: string) => {})
);

vi.mock("cloudflare:workers", () => ({
  waitUntil: (promise: Promise<unknown>) => backgroundTasks.push(promise)
}));

vi.mock("@vmb/db", () => ({
  createDb: () => ({}),
  user: "user",
  session: "session",
  account: "account",
  verification: "verification"
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: () => memoryAdapter(memoryDb)
}));

vi.mock("./master.js", () => ({
  masterStore: () => ({ getSignInEligibility: async () => ({ deletedAt: null }) })
}));

vi.mock("./email.js", () => ({
  sendVerificationEmail: vi.fn(),
  sendOtpEmail: (env: unknown, to: string, otp: string) => sendOtpEmailMock(env, to, otp)
}));

const { default: app } = await import("./index.js");

const bindings = {
  DATABASE_URL: "postgres://test",
  BETTER_AUTH_SECRET: "a-test-secret-that-is-long-enough-to-pass",
  BETTER_AUTH_URL: "http://localhost:8787",
  WEB_URL: "http://localhost:5173",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "onboarding@resend.dev"
};

const REGISTERED = "staff@vmblogistics.id";
const UNREGISTERED = "nobody@vmblogistics.id";

async function requestCode(email: string) {
  const res = await app.request(
    "/api/auth/email-otp/request-password-reset",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: bindings.WEB_URL },
      body: JSON.stringify({ email })
    },
    bindings
  );
  return { status: res.status, body: await res.text() };
}

beforeEach(() => {
  const now = new Date();
  memoryDb.user = [
    {
      id: "user-1",
      name: "Staff",
      email: REGISTERED,
      emailVerified: true,
      createdAt: now,
      updatedAt: now
    }
  ];
  memoryDb.verification = [];
  backgroundTasks.length = 0;
  sendOtpEmailMock.mockReset();
  sendOtpEmailMock.mockImplementation(async () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/email-otp/request-password-reset", () => {
  it("gives a registered and an unregistered email the same status and body", async () => {
    const registered = await requestCode(REGISTERED);
    const unregistered = await requestCode(UNREGISTERED);

    expect(registered.status).toBe(200);
    expect(unregistered).toEqual(registered);
  });

  it('gives the same reply again for "Send a new code"', async () => {
    const first = [await requestCode(REGISTERED), await requestCode(UNREGISTERED)];
    const again = [await requestCode(REGISTERED), await requestCode(UNREGISTERED)];

    expect(again).toEqual(first);
    expect(new Set(again.map((reply) => reply.body)).size).toBe(1);
  });

  it("emails a code only to the registered address", async () => {
    await requestCode(REGISTERED);
    await requestCode(UNREGISTERED);

    expect(sendOtpEmailMock).toHaveBeenCalledOnce();
    expect(sendOtpEmailMock).toHaveBeenCalledWith(bindings, REGISTERED, expect.any(String));
  });

  it("replies without waiting for the email to send, handing the send to waitUntil", async () => {
    // A send that never settles: had the reply awaited it, this test would hang.
    sendOtpEmailMock.mockImplementation(() => new Promise<void>(() => {}));

    const reply = await requestCode(REGISTERED);

    expect(reply.status).toBe(200);
    expect(sendOtpEmailMock).toHaveBeenCalledOnce();
    expect(backgroundTasks).toHaveLength(1);
  });

  it("logs a failed send on the server and still gives the usual reply", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    sendOtpEmailMock.mockRejectedValueOnce(new Error("Resend is down"));

    const failed = await requestCode(REGISTERED);
    await Promise.all(backgroundTasks);

    expect(failed).toEqual(await requestCode(UNREGISTERED));
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to run background task"),
      expect.objectContaining({ message: "Resend is down" })
    );
  });
});
