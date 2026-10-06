import { AccessSchema } from "@vmb/types";
import { Hono } from "hono";
import type { Bindings } from "../bindings.js";
import { masterStore } from "../master.js";

/**
 * The signed-in caller's own access (#8): which permissions their roles grant
 * and which divisions they belong to. Behind `requireSession`, and open to any
 * signed-in user: it describes only the caller.
 */
export const meRoute = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>().get(
  "/",
  async (c) => {
    const access = await masterStore(c.env).getAccess(c.get("userId"));
    return c.json(AccessSchema.parse(access));
  }
);
