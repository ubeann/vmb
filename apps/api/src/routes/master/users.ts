import {
  BulkRequestSchema,
  BulkResponseSchema,
  PASSWORD_BREACHED_CODE,
  PASSWORD_BREACHED_MESSAGE,
  UserCreateInputSchema,
  UserListRequestSchema,
  UserListResponseSchema,
  UserSchema,
  UserUpdateInputSchema
} from "@vmb/types";
import { Hono, type Context } from "hono";
import { actor, assertPermission, requirePermission } from "./permission.js";
import { HttpError, jsonBody, pathId, queryParams } from "../../http.js";
import type { MasterEnv } from "./env.js";

// The Master CRUD hashes the password itself, so Better Auth's own check never
// sees it (ADR-0041). An empty password means "leave the credential alone".
async function refuseBreachedPassword(c: Context<MasterEnv>, password: string) {
  if (password !== "" && (await c.get("isPasswordBreached")(password))) {
    throw new HttpError(400, PASSWORD_BREACHED_CODE, PASSWORD_BREACHED_MESSAGE, [
      { path: "password", message: PASSWORD_BREACHED_MESSAGE }
    ]);
  }
}

export const userRoutes = new Hono<MasterEnv>()
  .get("/", requirePermission("master-users.view_any"), async (c) => {
    const query = queryParams(c, UserListRequestSchema);
    const page = await c.get("store").listUsers(query, actor(c));
    return c.json(UserListResponseSchema.parse(page));
  })
  .post(
    "/",
    requirePermission("master-users.create"),
    jsonBody(UserCreateInputSchema),
    async (c) => {
      const input = c.req.valid("json");
      await refuseBreachedPassword(c, input.password);
      const user = await c.get("store").createUser(input, actor(c));
      return c.json(UserSchema.parse(user), 201);
    }
  )
  // delete or restore several at once, all or none (#305); the action names the `_any`
  // permission, as legacy's bulk actions did (#467)
  .post("/bulk", jsonBody(BulkRequestSchema), async (c) => {
    const request = c.req.valid("json");
    await assertPermission(
      c,
      request.action === "delete" ? "master-users.delete_any" : "master-users.restore_any"
    );
    const done = await c.get("store").bulkUsers(request, actor(c));
    return c.json(BulkResponseSchema.parse(done));
  })
  .get("/:id", requirePermission("master-users.view"), async (c) => {
    const user = await c.get("store").getUser(pathId(c), actor(c));
    return c.json(UserSchema.parse(user));
  })
  .patch(
    "/:id",
    requirePermission("master-users.update"),
    jsonBody(UserUpdateInputSchema),
    async (c) => {
      const id = pathId(c);
      const input = c.req.valid("json");
      await refuseBreachedPassword(c, input.password);
      const user = await c.get("store").updateUser(id, input, actor(c));
      return c.json(UserSchema.parse(user));
    }
  )
  .delete("/:id", requirePermission("master-users.delete"), async (c) => {
    await c.get("store").deleteUser(pathId(c), actor(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", requirePermission("master-users.restore"), async (c) => {
    const user = await c.get("store").restoreUser(pathId(c), actor(c));
    return c.json(UserSchema.parse(user));
  });
