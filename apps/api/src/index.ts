import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { Bindings } from "./bindings.js";
import { masterStore } from "./master.js";
import { requireSession } from "./require-session.js";
import { authRoute } from "./routes/auth.js";
import { healthRoute } from "./routes/health.js";
import { meRoute } from "./routes/me.js";
import { createMasterRoutes } from "./routes/master/index.js";

const app = new Hono<{ Bindings: Bindings }>()
  // ADR-0047: Hono's defaults (HSTS, nosniff, COOP/CORP, no-referrer) plus
  // OWASP's REST set for a JSON-only API: nothing may load or frame a reply.
  .use(
    "*",
    secureHeaders({
      xFrameOptions: "DENY",
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }
    })
  )
  .route("/health", healthRoute)
  // Auth endpoints stay open by construction: Better Auth's handler answers
  // them, and the registered-before-the-guard order means the chain ends
  // there. Everything under /api/master and /api/me requires a session (#7); the
  // master routes further require the permission each one names (#8).
  .route("/api/auth", authRoute)
  .use("/api/me", requireSession)
  .route("/api/me", meRoute)
  .use("/api/master/*", requireSession)
  .route("/api/master", createMasterRoutes(masterStore));

export type AppType = typeof app;
export default app;
