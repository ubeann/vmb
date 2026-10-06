import {
  RoleInputSchema,
  RoleListQuerySchema,
  RoleListResponseSchema,
  RoleSchema
} from "@vmb/types";
import { Hono } from "hono";
import { requirePermission } from "./permission.js";
import { jsonBody, pathId, queryParams, type MasterEnv } from "./http.js";

export const roleRoutes = new Hono<MasterEnv>()
  .get("/", requirePermission("master-roles.view_any"), async (c) => {
    const query = queryParams(c, RoleListQuerySchema);
    const page = await c.get("store").listRoles(query);
    return c.json(RoleListResponseSchema.parse(page));
  })
  .post("/", requirePermission("master-roles.create"), jsonBody(RoleInputSchema), async (c) => {
    const role = await c.get("store").createRole(c.req.valid("json"));
    return c.json(RoleSchema.parse(role), 201);
  })
  .get("/:id", requirePermission("master-roles.view"), async (c) => {
    const role = await c.get("store").getRole(pathId(c));
    return c.json(RoleSchema.parse(role));
  })
  .patch("/:id", requirePermission("master-roles.update"), jsonBody(RoleInputSchema), async (c) => {
    const role = await c.get("store").updateRole(pathId(c), c.req.valid("json"));
    return c.json(RoleSchema.parse(role));
  })
  .delete("/:id", requirePermission("master-roles.delete"), async (c) => {
    await c.get("store").deleteRole(pathId(c));
    return c.body(null, 204);
  });
