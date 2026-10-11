import { ApiErrorSchema, CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";
import { rateLimit, user } from "@vmb/db";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, type TestDatabase } from "../../../packages/db/test/harness.js";

// Match the database suite's allowance for booting WASM Postgres and replaying
// migrations when the full monorepo suite is competing for CPU.
vi.setConfig({ hookTimeout: 30_000, testTimeout: 30_000 });

// The activate request step through the real Better Auth handler, on an
// embedded Postgres database and real Drizzle adapter. A reply must not tell a registered email from an
// unregistered one, by its body or by how long it takes (#232), and the rate
// limits on it count in that database, per client IP (#251, ADR-0042).
let database: TestDatabase;
const backgroundTasks = vi.hoisted(() => [] as Promise<unknown>[]);
const sendOtpEmailMock = vi.hoisted(() =>
  vi.fn(async (_env: unknown, _to: string, _otp: string) => {})
);

vi.mock("cloudflare:workers", () => ({
  waitUntil: (promise: Promise<unknown>) => backgroundTasks.push(promise)
}));

vi.mock("@vmb/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vmb/db")>()),
  createDb: () => database.db
}));

vi.mock("./master.js", () => ({
  masterStore: () => ({ getSignInEligibility: async () => ({ deletedAt: null, status: "active" }) })
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
async function requestCode(
  email: string,
  clientIp = "203.0.113.10",
  path = "/email-otp/request-password-reset"
) {
  const res = await app.request(
    `/api/auth${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: bindings.WEB_URL,
        [CLIENT_IP_HEADER]: clientIp,
        [CLIENT_IP_SECRET_HEADER]: bindings.CLIENT_IP_SECRET
      },
      body: JSON.stringify({ email, type: "forget-password" })
    },
    bindings
  );
  return {
    status: res.status,
    body: await res.text(),
    retryAfter: res.headers.get("X-Retry-After")
  };
}

beforeAll(async () => {
  database = await createDatabase();
  await database.migrate();
});

afterAll(async () => {
  await database?.close();
});

beforeEach(async () => {
  await database.client.exec(
    'truncate public."user", public.verification, public.rate_limit cascade'
  );
  const now = new Date();
  await database.db.insert(user).values([
    {
      id: "user-1",
      name: "Staff",
      email: REGISTERED,
      emailVerified: true,
      createdAt: now,
      updatedAt: now
    }
  ]);
  backgroundTasks.length = 0;
  sendOtpEmailMock.mockReset();
  sendOtpEmailMock.mockImplementation(async () => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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

  it("answers the per-IP 429 with the API error contract (ADR-0048)", async () => {
    for (let i = 0; i < 3; i++) await requestCode(REGISTERED, "198.51.100.8");
    const limited = await requestCode(REGISTERED, "198.51.100.8");

    expect(limited.status).toBe(429);
    const body = ApiErrorSchema.strict().parse(JSON.parse(limited.body));
    expect(body).toEqual({
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later."
    });
  });

  it("gives the 429 of any auth path the same code, not only the code request", async () => {
    // Better Auth's built-in rule for sign-in: 3 requests per 10 s.
    const replies = [];
    for (let i = 0; i < 4; i++) {
      replies.push(await requestCode(REGISTERED, "198.51.100.9", "/sign-in/email"));
    }

    const limited = replies.at(-1);
    expect(limited?.status).toBe(429);
    expect(ApiErrorSchema.strict().parse(JSON.parse(limited?.body ?? ""))).toMatchObject({
      code: "RATE_LIMITED"
    });
    expect(replies.slice(0, 3).every((reply) => reply.status !== 429)).toBe(true);
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

    const rows = await database.db.select().from(rateLimit);
    expect(rows.filter((row) => !row.key.startsWith("code-request:"))).toEqual([
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
    expect(await database.db.select().from(rateLimit)).toEqual([]);
  });
});

describe("per-email code request limit (#252)", () => {
  it("allows five requests across client IPs, then replies like the per-IP limit for either email", async () => {
    for (const email of [REGISTERED, UNREGISTERED]) {
      for (let i = 0; i < 5; i++) {
        expect((await requestCode(email, `198.51.100.${20 + i}`)).status).toBe(200);
      }
    }
    const registered = await requestCode(REGISTERED, "198.51.100.30");
    const unregistered = await requestCode(UNREGISTERED, "198.51.100.31");

    for (let i = 0; i < 3; i++) await requestCode("another@example.com", "198.51.100.40");
    const ipLimited = await requestCode("another@example.com", "198.51.100.40");

    expect(registered.status).toBe(429);
    expect(registered).toEqual(unregistered);
    expect(registered).toEqual(ipLimited);
    expect(registered.retryAfter).toBeNull();
    expect(ApiErrorSchema.strict().parse(JSON.parse(registered.body))).toEqual({
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later."
    });
    expect(sendOtpEmailMock).toHaveBeenCalledTimes(5);
  });

  it("shares a counter across casing and surrounding whitespace, without storing typed emails", async () => {
    const addresses = [
      REGISTERED,
      REGISTERED.toUpperCase(),
      ` ${REGISTERED} `,
      REGISTERED,
      REGISTERED
    ];
    for (const [i, email] of addresses.entries()) {
      expect((await requestCode(email, `198.51.100.${50 + i}`)).status).toBe(200);
    }
    expect((await requestCode(` ${REGISTERED.toUpperCase()} `, "198.51.100.60")).status).toBe(429);
    // Normalization is also passed on to the OTP handler: each allowed request
    // really addresses the same User, including the whitespace variants.
    expect(sendOtpEmailMock).toHaveBeenCalledTimes(5);
    for (const call of sendOtpEmailMock.mock.calls) expect(call[1]).toBe(REGISTERED);

    const rows = await database.db.select().from(rateLimit);
    const emailRows = rows.filter((row) => row.key.startsWith("code-request:"));
    expect(emailRows).toHaveLength(1);
    expect(emailRows[0]).toMatchObject({
      // Independent HMAC-SHA256 vector, using the fixture secret above.
      key: "code-request:6262f4d9c57f3e531a29386de66af755f07f94cbeb711e6f9d47b246a8fd1ef6",
      count: 5
    });
    expect(JSON.stringify(rows)).not.toContain(REGISTERED);
    expect(JSON.stringify(rows)).not.toContain(REGISTERED.toUpperCase());
  });

  it("allows only five simultaneous requests, including when the counter does not exist yet", async () => {
    const replies = await Promise.all(
      Array.from({ length: 12 }, (_, i) => requestCode(UNREGISTERED, `192.0.2.${50 + i}`))
    );
    expect(replies.filter((reply) => reply.status === 200)).toHaveLength(5);
    expect(replies.filter((reply) => reply.status === 429)).toHaveLength(7);
  });

  it("keeps the hourly counter through IP cleanup and resets after an hour, without blocked requests extending it", async () => {
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    for (let i = 0; i < 5; i++) await requestCode(UNREGISTERED, `192.0.2.${70 + i}`);

    clock.mockReturnValue(start + 61_000);
    // Reuse an expired IP counter: Better Auth's database store prunes here.
    await requestCode("another@example.com", "192.0.2.70");
    await Promise.all(backgroundTasks);
    expect((await requestCode(UNREGISTERED, "192.0.2.80")).status).toBe(429);

    clock.mockReturnValue(start + 3_599_000);
    expect((await requestCode(UNREGISTERED, "192.0.2.81")).status).toBe(429);
    clock.mockReturnValue(start + 3_600_000);
    const replies = await Promise.all(
      Array.from({ length: 8 }, (_, i) => requestCode(UNREGISTERED, `192.0.2.${90 + i}`))
    );
    expect(replies.filter((reply) => reply.status === 200)).toHaveLength(5);
    expect(replies.filter((reply) => reply.status === 429)).toHaveLength(3);
  });
});

// The code step's Verify (#254): it checks a code without using it up. An
// unregistered email's unsent decoy reads exactly like a registered email's
// wrong, expired or exhausted code (#232, #271).
async function checkCode(email: string, otp: string, clientIp = "192.0.2.10") {
  const res = await app.request(
    "/api/auth/email-otp/check-verification-otp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: bindings.WEB_URL,
        [CLIENT_IP_HEADER]: clientIp,
        [CLIENT_IP_SECRET_HEADER]: bindings.CLIENT_IP_SECRET
      },
      body: JSON.stringify({ email, otp, type: "forget-password" })
    },
    bindings
  );
  return { status: res.status, body: await res.text() };
}

// The code emailed to REGISTERED by its latest request, and one that is not it.
const sentCode = () => sendOtpEmailMock.mock.lastCall![2];
const wrongCode = () => (sentCode() === "000000" ? "111111" : "000000");

describe("POST /api/auth/email-otp/check-verification-otp", () => {
  it("exhausts the same attempt budget for registered and unregistered emails (#271)", async () => {
    await requestCode(REGISTERED, "192.0.2.1");
    await requestCode(UNREGISTERED, "192.0.2.2");

    for (let attempt = 0; attempt < 5; attempt++) {
      const registered = await checkCode(REGISTERED, wrongCode(), `192.0.2.${40 + attempt}`);
      const unregistered = await checkCode(UNREGISTERED, wrongCode(), `192.0.2.${50 + attempt}`);
      expect(unregistered).toEqual(registered);
      expect(JSON.parse(registered.body).code).toBe(
        attempt === 3 ? "TOO_MANY_ATTEMPTS" : "INVALID_OTP"
      );
    }
  });

  it("answers an unregistered email exactly like a registered one with a wrong code", async () => {
    await requestCode(REGISTERED, "192.0.2.1");
    await requestCode(UNREGISTERED, "192.0.2.2");
    const registered = await checkCode(REGISTERED, wrongCode(), "192.0.2.3");
    const unregistered = await checkCode(UNREGISTERED, wrongCode(), "192.0.2.4");

    expect(registered.status).toBe(400);
    expect(JSON.parse(registered.body)).toMatchObject({ code: "INVALID_OTP" });
    expect(unregistered).toEqual(registered);
  });

  it("accepts the right code without using it up, so the password step can still spend it", async () => {
    await requestCode(REGISTERED, "192.0.2.5");
    const code = sentCode();

    const first = await checkCode(REGISTERED, code, "192.0.2.6");
    const again = await checkCode(REGISTERED, code, "192.0.2.7");

    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
  });

  it("counts wrong tries toward the 3 attempts a code allows", async () => {
    await requestCode(REGISTERED, "192.0.2.8");
    // One client per try: the route allows 3 checks a minute from one IP.
    for (let i = 0; i < 3; i++) await checkCode(REGISTERED, wrongCode(), `192.0.2.${20 + i}`);

    const right = await checkCode(REGISTERED, sentCode(), "192.0.2.30");

    expect(right.status).toBe(403);
    expect(JSON.parse(right.body)).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });
});

async function resetPassword(email: string, otp: string, clientIp = "192.0.2.100") {
  const res = await app.request(
    "/api/auth/email-otp/reset-password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: bindings.WEB_URL,
        [CLIENT_IP_HEADER]: clientIp,
        [CLIENT_IP_SECRET_HEADER]: bindings.CLIENT_IP_SECRET
      },
      body: JSON.stringify({ email, otp, password: "a-new-activation-password" })
    },
    bindings
  );
  return { status: res.status, body: await res.text() };
}

describe("OTP expiry and redemption privacy (#271)", () => {
  it.each([
    ["check", checkCode],
    ["reset", resetPassword]
  ] as const)(
    "%s gives the same expired-code reply and then invalid-code reply",
    async (_name, submit) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      async function expired(email: string, ip: string) {
        await requestCode(email, ip);
        // Run each email's expiry separately: Better Auth's lookup cleans up
        // all expired rows, so an earlier lookup can collect the other fixture.
        vi.setSystemTime(Date.now() + 300_001);
        return [await submit(email, "000000", ip), await submit(email, "000000", ip)];
      }
      const registered = await expired(REGISTERED, "192.0.2.110");
      const unknown = await expired(UNREGISTERED, "192.0.2.111");
      expect(unknown).toEqual(registered);
      expect(JSON.parse(registered[0]!.body).code).toBe("OTP_EXPIRED");
      expect(JSON.parse(registered[1]!.body).code).toBe("INVALID_OTP");
    }
  );

  it("shares the same attempt budget across Verify and reset for both emails", async () => {
    await requestCode(REGISTERED);
    await requestCode(UNREGISTERED);
    const submitters = [checkCode, resetPassword, resetPassword, resetPassword, resetPassword];
    for (const [attempt, submit] of submitters.entries()) {
      const registered = await submit(REGISTERED, wrongCode(), `192.0.2.${120 + attempt}`);
      const unknown = await submit(UNREGISTERED, wrongCode(), `192.0.2.${130 + attempt}`);
      expect(unknown).toEqual(registered);
      expect(JSON.parse(registered.body).code).toBe(
        attempt === 3 ? "TOO_MANY_ATTEMPTS" : "INVALID_OTP"
      );
    }
  });

  it("lets a migrated User check and spend the mailed code once, then sign in", async () => {
    await requestCode(REGISTERED);
    const code = sentCode();
    expect((await checkCode(REGISTERED, code)).status).toBe(200);
    expect((await resetPassword(REGISTERED, code)).status).toBe(200);
    const replay = await resetPassword(REGISTERED, code);
    expect(JSON.parse(replay.body).code).toBe("INVALID_OTP");
    const login = await app.request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: bindings.WEB_URL },
        body: JSON.stringify({ email: REGISTERED, password: "a-new-activation-password" })
      },
      bindings
    );
    expect(login.status).toBe(200);
  });

  it("resending replaces the previous code and restores the attempt budget for both emails", async () => {
    await requestCode(REGISTERED, "192.0.2.140");
    const oldCode = sentCode();
    await requestCode(UNREGISTERED, "192.0.2.141");
    for (let attempt = 0; attempt < 4; attempt++) {
      await checkCode(REGISTERED, wrongCode(), `192.0.2.${150 + attempt}`);
      await checkCode(UNREGISTERED, wrongCode(), `192.0.2.${160 + attempt}`);
    }
    await requestCode(REGISTERED, "192.0.2.140");
    await requestCode(UNREGISTERED, "192.0.2.141");
    expect(await checkCode(UNREGISTERED, wrongCode(), "192.0.2.170")).toEqual(
      await checkCode(REGISTERED, wrongCode(), "192.0.2.171")
    );
    // A newly generated six-digit code can coincide with the old one.
    if (oldCode !== sentCode()) {
      expect(JSON.parse((await checkCode(REGISTERED, oldCode, "192.0.2.172")).body).code).toBe(
        "INVALID_OTP"
      );
    }
    expect((await resetPassword(REGISTERED, sentCode())).status).toBe(200);
  });

  it.each(["/forget-password/email-otp", "/email-otp/send-verification-otp"])(
    "also retains decoys through the alternative request endpoint %s",
    async (path) => {
      await requestCode(REGISTERED.toUpperCase(), "192.0.2.180", path);
      await requestCode(UNREGISTERED.toUpperCase(), "192.0.2.181", path);
      for (let attempt = 0; attempt < 4; attempt++) {
        const registered = await checkCode(REGISTERED, wrongCode(), `192.0.2.${190 + attempt}`);
        const unknown = await checkCode(UNREGISTERED, wrongCode(), `192.0.2.${200 + attempt}`);
        expect(unknown).toEqual(registered);
        expect(JSON.parse(registered.body).code).toBe(
          attempt === 3 ? "TOO_MANY_ATTEMPTS" : "INVALID_OTP"
        );
      }
      expect(sendOtpEmailMock).toHaveBeenCalledOnce();
    }
  );
});
