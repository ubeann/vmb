import type { AuthContext } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { generateRandomString } from "better-auth/crypto";
import { emailOTP } from "better-auth/plugins/email-otp";
import { z } from "zod";

const expiresIn = 300;

// Given to the plugin as its hasher, so issuance and checking share one function.
async function hashOtp(otp: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

// The endpoints that spend or check a code, with the OTP type each reads.
const CODE_PATHS: Record<string, (body: Record<string, unknown>) => unknown> = {
  "/email-otp/reset-password": () => "forget-password",
  "/email-otp/check-verification-otp": (body) => body.type,
  "/email-otp/verify-email": () => "email-verification",
  "/sign-in/email-otp": () => "sign-in"
};

// Better Auth 1.7.7 deletes an unknown email's code on issuance. Keeping an
// unsent decoy instead gives its checks the same expiry, attempt budget and
// database work (#271). Verification and atomic redemption remain upstream.
// A Trashed user (ADR-0055) is an unknown email to every one of these paths:
// `isTrashed` says whether a user's business record is in the Trash.
export function privateEmailOtp(
  send: (email: string, otp: string) => Promise<void>,
  isTrashed: (userId: string) => Promise<boolean>
) {
  const plugin = emailOTP({
    disableSignUp: true,
    expiresIn,
    storeOTP: { hash: hashOtp },
    sendVerificationOTP: ({ email, otp }) => send(email, otp)
  });

  async function issue(context: AuthContext, rawEmail: string, type: string) {
    const email = rawEmail.toLowerCase();
    if (!z.email().safeParse(email).success) {
      throw new APIError("BAD_REQUEST", { code: "INVALID_EMAIL", message: "Invalid email" });
    }
    const found = await context.internalAdapter.findUserByEmail(email);
    // An unknown email gets the same business-record lookup, for a random id,
    // so the three kinds of email cost the same.
    const trashed = await isTrashed(found?.user.id ?? crypto.randomUUID());
    const user = trashed ? null : found;
    // Generate both in either case. A decoy is not a guessable six-digit code;
    // hashing gives both stored values the same length and comparison path.
    const otp = generateRandomString(6, "0-9");
    const decoy = generateRandomString(32, "a-z", "A-Z", "0-9");
    const identifier = `${type}-otp-${email}`;
    const value = await hashOtp(user ? otp : decoy);
    await context.internalAdapter.deleteVerificationByIdentifier(identifier);
    await context.internalAdapter.createVerificationValue({
      identifier,
      value: `${value}:0`,
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    });
    if (user) await context.runInBackgroundOrAwait(send(email, otp));
    return { success: true };
  }

  // A code issued before a user was Trashed is still stored for them. Before
  // Better Auth checks or spends it, swap its secret for an unsent decoy,
  // keeping the attempt count and expiry: the code then fails as an unknown
  // email's does, and no credential is written for a Trashed user. Any other
  // email does the same reads and one write, aimed at an identifier that has no
  // row, so the work is equal (#405) and no live user's attempt count is touched.
  const decoyTrashedCode = createAuthMiddleware(async (ctx) => {
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const type = CODE_PATHS[ctx.path]?.(body);
    if (typeof body.email !== "string" || typeof type !== "string") return;
    const email = body.email.toLowerCase();
    const found = await ctx.context.internalAdapter.findUserByEmail(email);
    const trashed = await isTrashed(found?.user.id ?? crypto.randomUUID());
    const identifier = trashed
      ? `${type}-otp-${email}`
      : `${type}-otp-${crypto.randomUUID()}@decoy.invalid`;
    // The adapter itself, not `findVerificationValue`: that one also deletes
    // every expired row, and an expired code must still read as expired.
    const where = [{ field: "identifier", value: identifier }];
    const row = await ctx.context.adapter.findOne<{ value: string }>({
      model: "verification",
      where
    });
    const attempts = row?.value.slice(row.value.lastIndexOf(":") + 1) ?? "0";
    const value = `${await hashOtp(generateRandomString(32, "a-z", "A-Z", "0-9"))}:${attempts}`;
    await ctx.context.adapter.update({ model: "verification", where, update: { value } });
  });

  const decoyHook = {
    matcher: (context: { path?: string }) => !!context.path && context.path in CODE_PATHS,
    handler: decoyTrashedCode
  };
  // The plugin's type lists only `after` hooks today. Append to whatever
  // `before` hooks a Better Auth upgrade adds, rather than replacing them.
  const upstreamBefore = (plugin.hooks as { before?: (typeof decoyHook)[] }).before ?? [];

  const endpoints = plugin.endpoints;
  return {
    ...plugin,
    hooks: {
      ...plugin.hooks,
      before: [...upstreamBefore, decoyHook]
    },
    endpoints: {
      ...endpoints,
      requestPasswordResetEmailOTP: createAuthEndpoint(
        endpoints.requestPasswordResetEmailOTP.path,
        endpoints.requestPasswordResetEmailOTP.options,
        (ctx) => issue(ctx.context, ctx.body.email, "forget-password")
      ),
      forgetPasswordEmailOTP: createAuthEndpoint(
        endpoints.forgetPasswordEmailOTP.path,
        endpoints.forgetPasswordEmailOTP.options,
        (ctx) => issue(ctx.context, ctx.body.email, "forget-password")
      ),
      sendVerificationOTP: createAuthEndpoint(
        endpoints.sendVerificationOTP.path,
        endpoints.sendVerificationOTP.options,
        (ctx) => {
          // Preserve the native rejection: changing an email has a separate,
          // authenticated endpoint. All public issuance paths keep decoys.
          if (ctx.body.type === "change-email") {
            throw new APIError("BAD_REQUEST", { message: "Invalid OTP type" });
          }
          return issue(ctx.context, ctx.body.email, ctx.body.type);
        }
      )
    }
  };
}
