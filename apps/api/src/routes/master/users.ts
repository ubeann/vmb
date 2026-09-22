import {
  UserCreateInputSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  UserSchema,
  UserUpdateInputSchema
} from "@vmb/types";
import { Hono } from "hono";
import { jsonBody, pathId, queryParams, type MasterEnv } from "./http.js";

export const userRoutes = new Hono<MasterEnv>()
  .get("/", async (c) => {
    const query = queryParams(c, UserListQuerySchema);
    const page = await c.get("store").listUsers(query);
    return c.json(UserListResponseSchema.parse(page));
  })
  .post("/", jsonBody(UserCreateInputSchema), async (c) => {
    const user = await c.get("store").createUser(c.req.valid("json"));
    return c.json(UserSchema.parse(user), 201);
  })
  .get("/:id", async (c) => {
    const user = await c.get("store").getUser(pathId(c));
    return c.json(UserSchema.parse(user));
  })
  .patch("/:id", jsonBody(UserUpdateInputSchema), async (c) => {
    const user = await c.get("store").updateUser(pathId(c), c.req.valid("json"));
    return c.json(UserSchema.parse(user));
  })
  .delete("/:id", async (c) => {
    await c.get("store").deleteUser(pathId(c));
    return c.body(null, 204);
  })
  .post("/:id/restore", async (c) => {
    const user = await c.get("store").restoreUser(pathId(c));
    return c.json(UserSchema.parse(user));
  });
