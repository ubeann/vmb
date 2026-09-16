import { account, createDb, session, user, verification } from "@vmb/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Bindings } from "./bindings.js";
import { sendVerificationEmail } from "./email.js";

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
      enabled: true,
      requireEmailVerification: true
    },
    emailVerification: {
      sendOnSignUp: true,
      // Resend the verification link if an unverified user tries to log in —
      // covers the case where the original signup email expired or was lost.
      sendOnSignIn: true,
      // NOT true: the verify-email link is opened directly from the user's
      // inbox, hitting apps/api's own origin outside of apps/web's
      // sveltekitCookies-forwarding flow — any session Better Auth created
      // here would land on the API's own origin, which the browser never
      // sends back to apps/web. Auto-sign-in would silently not work, so
      // don't advertise it; the user logs in normally after verifying.
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(env, user.email, url);
      }
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
