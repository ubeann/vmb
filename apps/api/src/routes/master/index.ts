import type { MasterStore } from "@vmb/db";
import { Hono } from "hono";
import type { Bindings } from "../../bindings.js";
import {
  isPasswordBreached as defaultIsPasswordBreached,
  type PasswordBreachCheck
} from "../../breached-password.js";
import { divisionRoutes } from "./divisions.js";
import type { MasterEnv } from "./env.js";
import { roleRoutes } from "./roles.js";
import { userRoutes } from "./users.js";

/**
 * The Master module's HTTP surface. The store is resolved per request through
 * the caller's factory, so tests drive these routes with a fake store and the
 * Worker with the cached one bound to its environment. Its errors reach the
 * root error handler (`../../error-reply.ts`), like every other route's.
 *
 * No explicit return type: an annotated `Hono<MasterEnv>` would erase the
 * route schema the RPC client infers from, leaving `AppType` with no master
 * paths at all.
 */
export function createMasterRoutes(
  resolveStore: (env: Bindings) => MasterStore,
  isPasswordBreached: PasswordBreachCheck = defaultIsPasswordBreached
) {
  return new Hono<MasterEnv>()
    .use("*", async (c, next) => {
      c.set("store", resolveStore(c.env));
      c.set("isPasswordBreached", isPasswordBreached);
      await next();
    })
    .route("/divisions", divisionRoutes)
    .route("/roles", roleRoutes)
    .route("/users", userRoutes);
}
