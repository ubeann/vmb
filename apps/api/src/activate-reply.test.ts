import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The activate request step through the real Better Auth handler, on an
// in-memory database. A reply must not tell a registered email from an
// unregistered one, by its body or by how long it takes (#232), and the rate
// limits on it count in that database, per client IP (#251, ADR-0042).
const memoryDb = vi.hoisted(
  () =>
    ({ user: [], session: [], account: [], verification: [], rateLimit: [] }) as Record<
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
  verification: "verification",
  rateLimit: "rateLimit"
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
  EMAIL_FROM: "onboarding@resend.dev",
  CLIENT_IP_SECRET: "a-test-client-ip-secret"
};

const REGISTERED = "staff@vmblogistics.id";
const UNREGISTERED = "nobody@vmblogistics.id";

// Sent the way apps/web sends it: the browser's address, vouched for by the
// shared secret (#250).
async function requestCode(email: string, clientIp = "203.0.113.10") {
  const res = await app.request(
    "/api/auth/email-otp/request-password-reset",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: bindings.WEB_URL,
        [CLIENT_IP_HEADER]: clientIp,
        [CLIENT_IP_SECRET_HEADER]: bindings.CLIENT_IP_SECRET
      },
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
  memoryDb.rateLimit = [];
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
    // One client per email: four requests from one would meet the rate limit.
    const send = (email: string) =>
      requestCode(email, email === REGISTERED ? "203.0.113.11" : "203.0.113.12");
    const first = [await send(REGISTERED), await send(UNREGISTERED)];
    const again = [await send(REGISTERED), await send(UNREGISTERED)];

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

describe("rate limits on the request step (#251)", () => {
  it("refuses the 4th code request in 60 s from one client IP, and not another IP's", async () => {
    const replies = [];
    for (let i = 0; i < 4; i++) replies.push(await requestCode(REGISTERED, "198.51.100.1"));

    expect(replies.slice(0, 3).map((reply) => reply.status)).toEqual([200, 200, 200]);
    expect(replies[3]?.status).toBe(429);
    expect((await requestCode(REGISTERED, "198.51.100.2")).status).toBe(200);
  });

  it("refuses a registered and an unregistered email alike", async () => {
    for (let i = 0; i < 3; i++) await requestCode(UNREGISTERED, "198.51.100.3");
    for (let i = 0; i < 3; i++) await requestCode(REGISTERED, "198.51.100.4");

    const unregistered = await requestCode(UNREGISTERED, "198.51.100.3");
    const registered = await requestCode(REGISTERED, "198.51.100.4");

    expect(unregistered.status).toBe(429);
    expect(registered).toEqual(unregistered);
  });

  it("counts in the database, one row per client IP and path", async () => {
    await requestCode(REGISTERED, "198.51.100.5");
    await requestCode(REGISTERED, "198.51.100.5");
    await requestCode(REGISTERED, "198.51.100.6");

    expect(memoryDb.rateLimit).toEqual([
      expect.objectContaining({
        key: expect.stringContaining("198.51.100.5"),
        count: 2,
        lastRequest: expect.any(Number)
      }),
      expect.objectContaining({ key: expect.stringContaining("198.51.100.6"), count: 1 })
    ]);
  });

  it("does not count reading the session", async () => {
    const res = await app.request(
      "/api/auth/get-session",
      {
        headers: {
          Origin: bindings.WEB_URL,
          [CLIENT_IP_HEADER]: "198.51.100.7",
          [CLIENT_IP_SECRET_HEADER]: bindings.CLIENT_IP_SECRET
        }
      },
      bindings
    );

    expect(res.status).toBe(200);
    expect(memoryDb.rateLimit).toEqual([]);
  });
});
