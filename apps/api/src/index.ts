import { Hono } from "hono";
import type { Bindings } from "./bindings.js";
import { masterStore } from "./master.js";
import { requireSession } from "./require-session.js";
import { authRoute } from "./routes/auth.js";
import { healthRoute } from "./routes/health.js";
import { createMasterRoutes } from "./routes/master/index.js";

const app = new Hono<{ Bindings: Bindings }>()
  .route("/health", healthRoute)
  // Auth endpoints stay open by construction: Better Auth's handler answers
  // them, and the registered-before-the-guard order means the chain ends
  // there. Everything under /api/master requires a session (#7).
  .route("/api/auth", authRoute)
  .use("/api/master/*", requireSession)
  .route("/api/master", createMasterRoutes(masterStore));

export type AppType = typeof app;
export default app;
