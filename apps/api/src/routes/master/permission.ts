import type { Actor } from "@vmb/db";
import type { PermissionKey } from "@vmb/types";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HttpError } from "../../http.js";
import type { MasterEnv } from "./env.js";

/**
 * Refuses the request unless one of the caller's active roles grants `key`.
 * A session only proves someone is signed in (`requireSession`); this is the
 * check that a particular person may do a particular thing (#8). The API is
 * the enforcement: hiding a button in the web app is a courtesy.
 *
 * The caller's permissions are read in one statement and kept on the request
 * for the store's guards (`actor`), so a request reads them once (ADR-0045's
 * amendment). They live only as long as the request: the next one reads again,
 * which is how a revoked grant takes effect.
 */
export function requirePermission(key: PermissionKey) {
  return createMiddleware<MasterEnv>(async (c, next) => {
    await assertPermission(c, key);
    await next();
  });
}

/**
 * `requirePermission` for a route whose key is known only from its body, as a
 * bulk action's is: call it once the body is read. It reads and keeps the
 * caller's permissions the same way.
 */
export async function assertPermission(c: Context<MasterEnv>, key: PermissionKey) {
  let permissions = c.get("permissions");
  if (permissions === undefined) {
    permissions = await c.get("store").getPermissions(c.get("userId"));
    c.set("permissions", permissions);
  }

  if (!permissions.includes(key)) {
    throw new HttpError(403, "FORBIDDEN", "You do not have permission to do that.");
  }
}

/** The caller, with the permissions `requirePermission` read for this request. */
export function actor(c: Context<MasterEnv>): Actor {
  const permissions = c.get("permissions");
  // a handler that asks for the caller sits behind `requirePermission`; one
  // that does not would otherwise hand the guards an empty set silently
  if (permissions === undefined) throw new Error("actor() needs requirePermission ahead of it");
  return { id: c.get("userId"), permissions };
}
