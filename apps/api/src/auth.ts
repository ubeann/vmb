import { account, createDb, rateLimit, session, user, verification } from "@vmb/db";
import {
  CLIENT_IP_HEADER,
  PASSWORD_BREACHED_CODE,
  PASSWORD_BREACHED_MESSAGE,
  PASSWORD_CONTEXT_CODE,
  PASSWORD_CONTEXT_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordContainsContext
} from "@vmb/types";
import { betterAuth } from "better-auth";
import { waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import type { Bindings } from "./bindings.js";
import { isPasswordBreached } from "./breached-password.js";
import { CODE_REQUEST_PATH, codeRequestLimit } from "./code-request-limit.js";
import { sendOtpEmail, sendVerificationEmail } from "./email.js";
import { masterStore } from "./master.js";
import { createSignInGate } from "./sign-in-gate.js";

// The endpoints that set a password over HTTP, and the body field each reads.
// `/set-password` is server-only, so it is not reachable and not listed.
// `/reset-password` (an emailed link) cannot be used while no
// `sendResetPassword` is configured, since no token is ever issued; it is listed
// so that turning it on later does not open a way round the rule.
const PASSWORD_FIELDS: Record<string, string> = {
  "/email-otp/reset-password": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword"
};

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
      customRules: {
        "/get-session": false,
        [CODE_REQUEST_PATH]: { window: 60, max: 3 }
      }
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
      disableSignUp: true,
      // The same bounds as the Master CRUD user form (ADR-0041).
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH
    },
    hooks: {
      // The context and breached-password checks, on the way in to every
      // endpoint that sets a password. On the email-OTP reset it runs before
      // the code is spent, so a refused password leaves the code to use again.
      // Better Auth's `haveibeenpwned` plugin is not used: it fails closed,
      // and VMB's check fails open (ADR-0041).
      before: createAuthMiddleware(async (ctx) => {
        const field = PASSWORD_FIELDS[ctx.path];
        if (!field) return;
        const body = ctx.body as Record<string, unknown> | undefined;
        const password = body?.[field];
        // A length Better Auth refuses itself is not worth a lookup.
        if (
          typeof password !== "string" ||
          password.length < PASSWORD_MIN_LENGTH ||
          password.length > PASSWORD_MAX_LENGTH
        ) {
          return;
        }
        // The words about the account come first: they need no lookup. The
        // email is in the body for the OTP reset and with the session for a
        // change; the emailed-link reset names only a token, so it has none.
        const email =
          ctx.path === "/email-otp/reset-password"
            ? body?.email
            : ctx.path === "/change-password"
              ? (await getSessionFromCtx(ctx, { disableRefresh: true }))?.user.email
              : undefined;
        if (typeof email === "string" && passwordContainsContext(password, email)) {
          throw APIError.from("BAD_REQUEST", {
            code: PASSWORD_CONTEXT_CODE,
            message: PASSWORD_CONTEXT_MESSAGE
          });
        }
        if (await isPasswordBreached(password)) {
          throw APIError.from("BAD_REQUEST", {
            code: PASSWORD_BREACHED_CODE,
            message: PASSWORD_BREACHED_MESSAGE
          });
        }
      })
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
      codeRequestLimit(db, env.BETTER_AUTH_SECRET),
      // Activation (ADR-0033): a migrated user has no credential row, proves
      // inbox control with a one-time code, and sets a fresh password. /activate
      // checks the code first (`check-verification-otp`, #254), then spends it
      // with the password. `disableSignUp` keeps an unknown email from being
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
