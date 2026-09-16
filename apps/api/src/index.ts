import { Hono } from "hono";
import type { Bindings } from "./bindings.js";
import { authRoute } from "./routes/auth.js";
import { healthRoute } from "./routes/health.js";

const app = new Hono<{ Bindings: Bindings }>()
  .route("/health", healthRoute)
  .route("/api/auth", authRoute);

export type AppType = typeof app;
export default app;
