import {
  MasterConflictError,
  MasterNotFoundError,
  MasterSystemRoleError,
  type MasterStore
} from "@vmb/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Bindings } from "../../bindings.js";
import {
  isPasswordBreached as defaultIsPasswordBreached,
  type PasswordBreachCheck
} from "../../breached-password.js";
import { divisionRoutes } from "./divisions.js";
import { HttpError, type MasterEnv } from "./http.js";
import { roleRoutes } from "./roles.js";
import { userRoutes } from "./users.js";

/**
 * The Master module's HTTP surface. The store is resolved per request through
 * the caller's factory, so tests drive these routes with a fake store and the
 * Worker with the cached one bound to its environment.
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
    .route("/users", userRoutes)
    .onError((error, c) => {
      if (error instanceof HttpError) {
        return c.json({ error: error.message, issues: error.issues }, error.status);
      }
      // Hono's body validator throws this for a malformed JSON body.
      if (error instanceof HTTPException) return error.getResponse();
      if (error instanceof MasterNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof MasterConflictError) return c.json({ error: error.message }, 409);
      if (error instanceof MasterSystemRoleError) return c.json({ error: error.message }, 403);

      console.error("master routes: unhandled error", error);
      return c.json({ error: "Something went wrong." }, 500);
    });
}
