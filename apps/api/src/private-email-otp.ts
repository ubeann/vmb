import type { AuthContext } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
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

// Better Auth 1.7.7 deletes an unknown email's code on issuance. Keeping an
// unsent decoy instead gives its checks the same expiry, attempt budget and
// database work (#271). Verification and atomic redemption remain upstream.
export function privateEmailOtp(send: (email: string, otp: string) => Promise<void>) {
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
    const user = await context.internalAdapter.findUserByEmail(email);
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

  const endpoints = plugin.endpoints;
  return {
    ...plugin,
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
