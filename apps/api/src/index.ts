import { Hono } from "hono";
import type { Bindings } from "./bindings.js";
import { masterStore } from "./master.js";
import { authRoute } from "./routes/auth.js";
import { healthRoute } from "./routes/health.js";
import { createMasterRoutes } from "./routes/master/index.js";

const app = new Hono<{ Bindings: Bindings }>()
  .route("/health", healthRoute)
  .route("/api/auth", authRoute)
  .route("/api/master", createMasterRoutes(masterStore));

export type AppType = typeof app;
export default app;
