import { AccessSchema, ProfileUpdateInputSchema, UserSchema } from "@vmb/types";
import { Hono } from "hono";
import type { Bindings } from "../bindings.js";
import { jsonBody } from "../http.js";
import { masterStore } from "../master.js";

/**
 * The signed-in caller's own record (#8, #458): which permissions their roles
 * grant and which divisions they belong to, and their profile. Behind
 * `requireSession`, and open to any signed-in user: each route describes or
 * changes only the caller, who is the session's user and never a name in the
 * request, so none needs a Master permission.
 */
export const meRoute = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>()
  .get("/", async (c) => {
    const access = await masterStore(c.env).getAccess(c.get("userId"));
    return c.json(AccessSchema.parse(access));
  })
  .get("/profile", async (c) => {
    const profile = await masterStore(c.env).getOwnProfile(c.get("userId"));
    return c.json(UserSchema.parse(profile));
  })
  // name, phone and photo only: the email, status and roles are an administrator's
  .patch("/profile", jsonBody(ProfileUpdateInputSchema), async (c) => {
    const saved = await masterStore(c.env).updateOwnProfile(c.get("userId"), c.req.valid("json"));
    return c.json(UserSchema.parse(saved));
  });
