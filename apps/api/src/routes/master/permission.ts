import type { PermissionKey } from "@vmb/types";
import { createMiddleware } from "hono/factory";
import { HttpError } from "../../http.js";
import type { MasterEnv } from "./env.js";

/**
 * Refuses the request unless one of the caller's active roles grants `key`.
 * A session only proves someone is signed in (`requireSession`); this is the
 * check that a particular person may do a particular thing (#8). The API is
 * the enforcement: hiding a button in the web app is a courtesy.
 */
export function requirePermission(key: PermissionKey) {
  return createMiddleware<MasterEnv>(async (c, next) => {
    const access = await c.get("store").getAccess(c.get("userId"));

    if (!access.permissions.includes(key)) {
      throw new HttpError(403, "FORBIDDEN", "You do not have permission to do that.");
    }

    await next();
  });
}
