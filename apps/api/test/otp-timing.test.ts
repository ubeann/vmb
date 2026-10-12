// Manual Neon experiment for #271, with a Trashed user added for #405. Use only an isolated development branch:
// OTP_TIMING_DATABASE_URL=... pnpm --filter @vmb/api test test/otp-timing.test.ts
// Email transport is stubbed; all auth and database operations are real.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createDb, sql } from "@vmb/db";
import { expect, it, vi } from "vitest";

vi.mock("../src/email.js", () => ({
  sendOtpEmail: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(async () => {})
}));

const databaseUrl = process.env.OTP_TIMING_DATABASE_URL;

it.skipIf(!databaseUrl)(
  "measures registered/unknown OTP replies on Neon",
  async () => {
    const { createAuth } = await import("../src/auth.js");
    const db = createDb(databaseUrl!);
    const id = randomUUID();
    const registered = `otp-timing-${id}@example.invalid`;
    const unknown = `otp-absent-${id}@example.invalid`;
    // A live user and a Trashed one: each a Better Auth identity and a business
    // record (ADR-0032), the Trashed one with `deleted_at` set (ADR-0055).
    const trashedId = randomUUID();
    const trashed = `otp-trashed-${id}@example.invalid`;
    const kinds = { registered, trashed, unknown };
    const auth = createAuth({
      DATABASE_URL: databaseUrl!,
      BETTER_AUTH_SECRET: "isolated-otp-timing-secret-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:8787",
      WEB_URL: "http://localhost:5173",
      RESEND_API_KEY: "unused",
      EMAIL_FROM: "unused@example.invalid"
    });
    let client = 0;
    const ips: string[] = [];
    async function call(path: string, email: string) {
      const ip = `198.18.${Math.floor(client / 250)}.${++client % 250}`;
      ips.push(ip);
      const start = performance.now();
      const response = await auth.handler(
        new Request(`http://localhost:8787/api/auth/email-otp/${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:5173",
            "x-vmb-client-ip": ip
          },
          // Deliberately not a possible six-digit OTP; never redeem the fixture.
          body: JSON.stringify({
            email,
            otp: "wrong-code",
            type: "forget-password",
            password: "timing-password-never-set"
          })
        })
      );
      const body = (await response.json()) as { code?: string };
      return { ms: performance.now() - start, status: response.status, code: body.code };
    }
    for (const [userId, email, deletedAt] of [
      [id, registered, null],
      [trashedId, trashed, new Date().toISOString()]
    ] as const) {
      await db.execute(
        sql`insert into "user" (id,name,email,email_verified,created_at,updated_at) values (${userId},'OTP timing',${email},true,now(),now())`
      );
      await db.execute(
        sql`insert into master.users (id,name,email,created_at,updated_at,deleted_at) values (${userId},'OTP timing',${email},now(),now(),${deletedAt})`
      );
    }
    try {
      type Kind = keyof typeof kinds;
      const results: Record<string, Record<Kind, number[]>> = {};
      for (const path of ["request-password-reset", "check-verification-otp", "reset-password"]) {
        const samples: Record<Kind, number[]> = { registered: [], trashed: [], unknown: [] };
        for (let i = 0; i < 14; i++) {
          // Rotate which case runs first. Discard two warm-up rounds.
          const order = (["registered", "trashed", "unknown"] as const).map(
            (_, n, all) => all[(n + i) % all.length]!
          );
          for (const kind of order) {
            const email = kinds[kind];
            // Each sample starts with a fresh request, before expiry/attempt limits,
            // and before the hourly per-email request limit (#252) can answer 429.
            await db.execute(
              sql`delete from verification where identifier = ${`forget-password-otp-${email}`}`
            );
            await db.execute(sql`delete from rate_limit where key like 'code-request:%'`);
            if (path !== "request-password-reset")
              expect((await call("request-password-reset", email)).status).toBe(200);
            const result = await call(path, email);
            expect(result.status).toBe(path === "request-password-reset" ? 200 : 400);
            if (path !== "request-password-reset") expect(result.code).toBe("INVALID_OTP");
            if (i >= 2) samples[kind].push(result.ms);
          }
        }
        results[path] = samples;
        const summary = Object.fromEntries(
          Object.entries(samples).map(([kind, values]) => {
            const sorted = [...values].sort((a, b) => a - b);
            return [
              kind,
              {
                n: sorted.length,
                p50: Math.round((sorted[5]! + sorted[6]!) / 2),
                min: Math.round(sorted[0]!),
                max: Math.round(sorted.at(-1)!)
              }
            ];
          })
        );
        console.log(path, JSON.stringify(summary));
      }
      console.log("OTP_TIMING_SAMPLES", JSON.stringify(results));
      if (process.env.OTP_TIMING_OUTPUT) {
        writeFileSync(process.env.OTP_TIMING_OUTPUT, JSON.stringify(results, null, 2));
      }
    } finally {
      await db.execute(
        sql`delete from verification where identifier in (${`forget-password-otp-${registered}`},${`forget-password-otp-${trashed}`},${`forget-password-otp-${unknown}`})`
      );
      await db.execute(sql`delete from master.users where id in (${id},${trashedId})`);
      await db.execute(sql`delete from "user" where id in (${id},${trashedId})`);
      for (const ip of ips)
        await db.execute(sql`delete from rate_limit where key like ${`%${ip}%`}`);
    }
  },
  300_000
);
