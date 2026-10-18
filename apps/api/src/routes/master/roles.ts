import {
  RoleDetailSchema,
  RoleInputSchema,
  RoleListRequestSchema,
  RoleListResponseSchema,
  RoleSchema,
  RoleUpdateInputSchema
} from "@vmb/types";
import { Hono } from "hono";
import { actor, requirePermission } from "./permission.js";
import { jsonBody, pathId, queryParams } from "../../http.js";
import type { MasterEnv } from "./env.js";

export const roleRoutes = new Hono<MasterEnv>()
  .get("/", requirePermission("master-roles.view_any"), async (c) => {
    const query = queryParams(c, RoleListRequestSchema);
    const page = await c.get("store").listRoles(query, actor(c));
    return c.json(RoleListResponseSchema.parse(page));
  })
  .post("/", requirePermission("master-roles.create"), jsonBody(RoleInputSchema), async (c) => {
    // the caller may grant only permissions they hold (ADR-0045's amendment of 2026-10-17)
    const role = await c.get("store").createRole(c.req.valid("json"), actor(c));
    return c.json(RoleSchema.parse(role), 201);
  })
  .get("/:id", requirePermission("master-roles.view"), async (c) => {
    const role = await c.get("store").getRole(pathId(c), actor(c));
    return c.json(RoleDetailSchema.parse(role));
  })
  .patch(
    "/:id",
    requirePermission("master-roles.update"),
    jsonBody(RoleUpdateInputSchema),
    async (c) => {
      const role = await c.get("store").updateRole(pathId(c), c.req.valid("json"), actor(c));
      return c.json(RoleSchema.parse(role));
    }
  )
  .delete("/:id", requirePermission("master-roles.delete"), async (c) => {
    await c.get("store").deleteRole(pathId(c));
    return c.body(null, 204);
  });
