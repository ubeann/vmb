import {
  RoleInputSchema,
  RoleListQuerySchema,
  RoleListResponseSchema,
  RoleSchema
} from "@vmb/types";
import { Hono } from "hono";
import { jsonBody, pathId, queryParams, type MasterEnv } from "./http.js";

export const roleRoutes = new Hono<MasterEnv>()
  .get("/", async (c) => {
    const query = queryParams(c, RoleListQuerySchema);
    const page = await c.get("store").listRoles(query);
    return c.json(RoleListResponseSchema.parse(page));
  })
  .post("/", jsonBody(RoleInputSchema), async (c) => {
    const role = await c.get("store").createRole(c.req.valid("json"));
    return c.json(RoleSchema.parse(role), 201);
  })
  .get("/:id", async (c) => {
    const role = await c.get("store").getRole(pathId(c));
    return c.json(RoleSchema.parse(role));
  })
  .patch("/:id", jsonBody(RoleInputSchema), async (c) => {
    const role = await c.get("store").updateRole(pathId(c), c.req.valid("json"));
    return c.json(RoleSchema.parse(role));
  })
  .delete("/:id", async (c) => {
    await c.get("store").deleteRole(pathId(c));
    return c.body(null, 204);
  });
