import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth.js";
import type { Bindings } from "./bindings.js";

/**
 * Rejects a request whose Better Auth session does not resolve — the API's
 * half of #7's gate (the web half is the request-level check in
 * `apps/web/src/hooks.server.ts`, honouring its public allowlist). It only
 * proves *someone* is signed in; whether that person may touch a resource is
 * #8's job, and whether their business record still exists is enforced at
 * session creation (`./sign-in-gate.ts`).
 */
export const requireSession = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Authentication required." }, 401);
  }

  await next();
});
