import { account, createDb, rateLimit, session, user, verification } from "@vmb/db";
import { CLIENT_IP_HEADER } from "@vmb/types";
import { betterAuth } from "better-auth";
import { waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import type { Bindings } from "./bindings.js";
import { sendOtpEmail, sendVerificationEmail } from "./email.js";
import { masterStore } from "./master.js";
import { createSignInGate } from "./sign-in-gate.js";

function buildAuth(env: Bindings) {
  const db = createDb(env.DATABASE_URL);
  const store = masterStore(env);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit }
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_URL],
    // On explicitly: Better Auth's default is on only when NODE_ENV is
    // "production", which the Worker never sets. Counted in Postgres so every
    // isolate sees the same count, and a preview's own Neon branch holds its
    // own (ADR-0042). Reading the session is exempt, so it costs no query.
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: { "/get-session": false }
    },
    advanced: {
      // Better Auth awaits an email send only when the user exists, so an
      // awaited Resend call made a registered email reply noticeably slower
      // than an unregistered one (#232). Handing sends to the Worker's
      // `waitUntil` returns the reply first; a failed send is still logged.
      backgroundTasks: { handler: waitUntil },
      // The browser's address, as the auth route vouches for it: apps/web's
      // header when its secret matches, else `cf-connecting-ip` (#250,
      // ADR-0042). No other header is read, since a caller could set it.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] }
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      // Public sign-up is gone (#7): users are provisioned by the Master CRUD,
      // as in the legacy app. Activation is the email-OTP flow below.
      disableSignUp: true
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
    },
    // The one seam that decides whether a session may exist at all (#7): the
    // business record must exist and not be soft-deleted. See ADR-0032/0033.
    databaseHooks: {
      session: {
        create: {
          before: createSignInGate((userId) => store.getSignInEligibility(userId))
        }
      }
    },
    plugins: [
      // Activation (ADR-0033): a migrated user has no credential row, proves
      // inbox control with a one-time code, and sets a fresh password on the
      // same screen. `disableSignUp` keeps an unknown email from being
      // auto-registered by the OTP endpoints.
      emailOTP({
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp }) => {
          await sendOtpEmail(env, email, otp);
        }
      })
    ]
  });
}

// Cached per Worker isolate: env bindings are constant for the isolate's
// lifetime, and Better Auth keeps in-memory state (one-time verification-token
// locks) that only works if the same instance handles every request — building
// a fresh one per request would silently reset that state (and the Drizzle
// adapter/route table) on every call.
let cached: ReturnType<typeof buildAuth> | undefined;

export function createAuth(env: Bindings) {
  cached ??= buildAuth(env);
  return cached;
}
