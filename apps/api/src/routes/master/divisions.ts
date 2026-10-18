import {
  BulkResponseSchema,
  DivisionBulkRequestSchema,
  DivisionDetailSchema,
  DivisionInputSchema,
  DivisionListRequestSchema,
  DivisionListResponseSchema,
  DivisionSchema,
  DivisionUpdateInputSchema,
  type DivisionBulkRequest,
  type PermissionKey
} from "@vmb/types";
import { Hono } from "hono";
import { assertPermission, requirePermission } from "./permission.js";
import { jsonBody, pathId, queryParams } from "../../http.js";
import type { MasterEnv } from "./env.js";

const BULK_PERMISSIONS = {
  delete: "master-divisions.delete_any",
  restore: "master-divisions.restore_any",
  activate: "master-divisions.update",
  deactivate: "master-divisions.update"
} as const satisfies Record<DivisionBulkRequest["action"], PermissionKey>;

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
  // delete, restore, activate or deactivate several at once, all or none (#305, #467); the action
  // names the permission: the `_any` keys are the bulk ones, as in legacy, and a switch is an update
  .post("/bulk", jsonBody(DivisionBulkRequestSchema), async (c) => {
    const request = c.req.valid("json");
    await assertPermission(c, BULK_PERMISSIONS[request.action]);
    const done = await c.get("store").bulkDivisions(request);
    return c.json(BulkResponseSchema.parse(done));
  })
  .get("/:id", requirePermission("master-divisions.view"), async (c) => {
    const division = await c.get("store").getDivision(pathId(c));
    return c.json(DivisionDetailSchema.parse(division));
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
