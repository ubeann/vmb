import {
  DivisionInputSchema,
  DivisionListQuerySchema,
  DivisionListResponseSchema,
  DivisionSchema
} from "@vmb/types";
import { Hono } from "hono";
import { jsonBody, pathId, queryParams, type MasterEnv } from "./http.js";

export const divisionRoutes = new Hono<MasterEnv>()
  .get("/", async (c) => {
    const query = queryParams(c, DivisionListQuerySchema);
    const page = await c.get("store").listDivisions(query);
    return c.json(DivisionListResponseSchema.parse(page));
  })
  .post("/", jsonBody(DivisionInputSchema), async (c) => {
    const division = await c.get("store").createDivision(c.req.valid("json"));
    return c.json(DivisionSchema.parse(division), 201);
  })
  .get("/:id", async (c) => {
    const division = await c.get("store").getDivision(pathId(c));
    return c.json(DivisionSchema.parse(division));
  })
  .patch("/:id", jsonBody(DivisionInputSchema), async (c) => {
    const division = await c.get("store").updateDivision(pathId(c), c.req.valid("json"));
    return c.json(DivisionSchema.parse(division));
  })
  .delete("/:id", async (c) => {
    await c.get("store").deleteDivision(pathId(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", async (c) => {
    const division = await c.get("store").restoreDivision(pathId(c));
    return c.json(DivisionSchema.parse(division));
  });
