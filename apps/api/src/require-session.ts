import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth.js";
import type { Bindings } from "./bindings.js";
import { trustedClientIpHeaders } from "./client-ip.js";

/**
 * Rejects a request whose Better Auth session does not resolve — the API's
 * half of #7's gate (the web half is the request-level check in
 * `apps/web/src/hooks.server.ts`, honouring its public allowlist). It only
 * proves *someone* is signed in; whether that person may touch a resource is
 * #8's job, and whether their business record still exists is enforced at
 * session creation (`./sign-in-gate.ts`).
 */
export const requireSession = createMiddleware<{
  Bindings: Bindings;
  Variables: { userId: string };
}>(async (c, next) => {
  // The same vouched-for client IP the auth routes give Better Auth (#250).
  const headers = await trustedClientIpHeaders(c.req.raw.headers, c.env.CLIENT_IP_SECRET);
  const session = await createAuth(c.env).api.getSession({ headers });

  if (!session) {
    return c.json({ error: "Authentication required." }, 401);
  }

  // the permission checks downstream (#8) need to know who is asking
  c.set("userId", session.user.id);
  await next();
});
