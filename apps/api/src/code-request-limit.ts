import { CODE_REQUEST_LIMIT, consumeCodeRequest, type Db } from "@vmb/db";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";

export const CODE_REQUEST_PATH = "/email-otp/request-password-reset";

/** Better Auth's own copy for a per-IP 429, which the per-email limit repeats. */
export const RATE_LIMITED_MESSAGE = "Too many requests. Please try again later.";

export function codeRequestLimit(db: Db, secret: string): BetterAuthPlugin {
  // Import once per auth instance. Only the HMAC goes into rate_limit, never
  // the address or a guessable unkeyed digest of it.
  const signingKey = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return {
    id: "code-request-limit",
    // Register the hour with Better Auth's database pruning. auth.ts overrides
    // this path's IP rule back to 3/minute; this hook enforces the email rule.
    rateLimit: [{ pathMatcher: (path) => path === CODE_REQUEST_PATH, ...CODE_REQUEST_LIMIT }],
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === CODE_REQUEST_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            if (typeof ctx.body?.email !== "string") return;
            const email = ctx.body.email.trim().toLowerCase();
            const signature = await crypto.subtle.sign(
              "HMAC",
              await signingKey,
              new TextEncoder().encode(`code-request:${email}`)
            );
            const digest = Array.from(new Uint8Array(signature), (byte) =>
              byte.toString(16).padStart(2, "0")
            ).join("");
            const result = await consumeCodeRequest(db, `code-request:${digest}`);
            if (!result.allowed) {
              // Same body and header convention as the per-IP 429, which
              // authRoute rewrites to this body.
              return new Response(
                JSON.stringify({ code: "RATE_LIMITED", message: RATE_LIMITED_MESSAGE }),
                {
                  status: 429,
                  statusText: "Too Many Requests",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Retry-After": String(result.retryAfter)
                  }
                }
              );
            }
            return { context: { body: { ...ctx.body, email } } };
          })
        }
      ]
    }
  };
}
