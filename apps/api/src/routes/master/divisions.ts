import {
  DivisionInputSchema,
  DivisionListRequestSchema,
  DivisionListResponseSchema,
  DivisionSchema,
  DivisionUpdateInputSchema
} from "@vmb/types";
import { Hono } from "hono";
import { requirePermission } from "./permission.js";
import { jsonBody, pathId, queryParams } from "../../http.js";
import type { MasterEnv } from "./env.js";

export const divisionRoutes = new Hono<MasterEnv>()
  .get("/", requirePermission("master-divisions.view_any"), async (c) => {
    const query = queryParams(c, DivisionListRequestSchema);
    const page = await c.get("store").listDivisions(query);
    return c.json(DivisionListResponseSchema.parse(page));
  })
  .post(
    "/",
    requirePermission("master-divisions.create"),
    jsonBody(DivisionInputSchema),
    async (c) => {
      const division = await c.get("store").createDivision(c.req.valid("json"));
      return c.json(DivisionSchema.parse(division), 201);
    }
  )
  .get("/:id", requirePermission("master-divisions.view"), async (c) => {
    const division = await c.get("store").getDivision(pathId(c));
    return c.json(DivisionSchema.parse(division));
  })
  .patch(
    "/:id",
    requirePermission("master-divisions.update"),
    jsonBody(DivisionUpdateInputSchema),
    async (c) => {
      const division = await c.get("store").updateDivision(pathId(c), c.req.valid("json"));
      return c.json(DivisionSchema.parse(division));
    }
  )
  .delete("/:id", requirePermission("master-divisions.delete"), async (c) => {
    await c.get("store").deleteDivision(pathId(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", requirePermission("master-divisions.restore"), async (c) => {
    const division = await c.get("store").restoreDivision(pathId(c));
    return c.json(DivisionSchema.parse(division));
  })
  // a row's Activate and Deactivate write the one flag, so they cannot overwrite a concurrent edit
  .post("/:id/activate", requirePermission("master-divisions.update"), async (c) => {
    const division = await c.get("store").setDivisionActive(pathId(c), true);
    return c.json(DivisionSchema.parse(division));
  })
  .post("/:id/deactivate", requirePermission("master-divisions.update"), async (c) => {
    const division = await c.get("store").setDivisionActive(pathId(c), false);
    return c.json(DivisionSchema.parse(division));
  });
