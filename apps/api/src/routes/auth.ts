import { ApiErrorSchema } from "@vmb/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "../auth.js";
import type { Bindings } from "../bindings.js";
import { trustedClientIpHeaders } from "../client-ip.js";
import { CODE_REQUEST_PATH, RATE_LIMITED_MESSAGE } from "../code-request-limit.js";

// A function origin (rather than passing `c.env.WEB_URL` as the `origin`
// string directly) lets this middleware be built once at module scope while
// still resolving per-request, and fails safe (no CORS header, not a thrown
// TypeError) if WEB_URL is ever unset.
const authCors = cors({
  origin: (origin, c) => (c.env.WEB_URL && origin === c.env.WEB_URL ? origin : undefined),
  credentials: true
});

export const authRoute = new Hono<{ Bindings: Bindings }>()
  .use("*", authCors)
  .use("*", async (c, next) => {
    await next();
    // Better Auth's per-IP limiter answers `{ message }` with no code; give it
    // the contract's body (ADR-0048). A 429 that already has a code is left be.
    if (c.res.status !== 429) return;
    const body: unknown = await c.res
      .clone()
      .json()
      .catch(() => null);
    if (typeof body === "object" && body !== null && "code" in body) return;
    c.res = c.json(
      ApiErrorSchema.parse({ code: "RATE_LIMITED", message: RATE_LIMITED_MESSAGE }),
      429
    );
  })
  .use(CODE_REQUEST_PATH, async (c, next) => {
    await next();
    // An hour versus a minute would identify which limit was hit (#252).
    // Apply to both Better Auth's IP reply and the per-email plugin's reply.
    if (c.res.status === 429) c.header("X-Retry-After", undefined);
  })
  // Better Auth keys rate limits on the client IP the request carries, so
  // the request is handed on with that IP settled first (#250).
  .all("*", async (c) => {
    const headers = await trustedClientIpHeaders(c.req.raw.headers, c.env.CLIENT_IP_SECRET);
    return createAuth(c.env).handler(new Request(c.req.raw, { headers }));
  });
