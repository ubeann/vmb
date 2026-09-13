import { account, createDb, session, user, verification } from "@vmb/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Bindings } from "./bindings.js";

function buildAuth(env: Bindings) {
  return betterAuth({
    database: drizzleAdapter(createDb(env.DATABASE_URL), {
      provider: "pg",
      schema: { user, session, account, verification }
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_URL],
    emailAndPassword: {
      enabled: true
    }
  });
}

// Cached per Worker isolate: env bindings are constant for the isolate's
// lifetime, and Better Auth keeps in-memory state (rate limiting, one-time
// verification-token locks) that only works if the same instance handles
// every request — building a fresh one per request would silently reset
// that state (and the Drizzle adapter/route table) on every call.
let cached: ReturnType<typeof buildAuth> | undefined;

export function createAuth(env: Bindings) {
  cached ??= buildAuth(env);
  return cached;
}

export type Auth = ReturnType<typeof createAuth>;
