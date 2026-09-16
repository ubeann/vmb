import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "../auth.js";
import type { Bindings } from "../bindings.js";

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
  .all("*", (c) => createAuth(c.env).handler(c.req.raw));
