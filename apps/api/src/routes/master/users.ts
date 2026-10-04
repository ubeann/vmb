import {
  PASSWORD_BREACHED_MESSAGE,
  UserCreateInputSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  UserSchema,
  UserUpdateInputSchema
} from "@vmb/types";
import { Hono, type Context } from "hono";
import { HttpError, jsonBody, pathId, queryParams, type MasterEnv } from "./http.js";

// The Master CRUD hashes the password itself, so Better Auth's own check never
// sees it (ADR-0041). An empty password means "leave the credential alone".
async function refuseBreachedPassword(c: Context<MasterEnv>, password: string) {
  if (password !== "" && (await c.get("isPasswordBreached")(password))) {
    throw new HttpError(400, PASSWORD_BREACHED_MESSAGE, [
      { path: "password", message: PASSWORD_BREACHED_MESSAGE }
    ]);
  }
}

export const userRoutes = new Hono<MasterEnv>()
  .get("/", async (c) => {
    const query = queryParams(c, UserListQuerySchema);
    const page = await c.get("store").listUsers(query);
    return c.json(UserListResponseSchema.parse(page));
  })
  .post("/", jsonBody(UserCreateInputSchema), async (c) => {
    const input = c.req.valid("json");
    await refuseBreachedPassword(c, input.password);
    const user = await c.get("store").createUser(input);
    return c.json(UserSchema.parse(user), 201);
  })
  .get("/:id", async (c) => {
    const user = await c.get("store").getUser(pathId(c));
    return c.json(UserSchema.parse(user));
  })
  .patch("/:id", jsonBody(UserUpdateInputSchema), async (c) => {
    const id = pathId(c);
    const input = c.req.valid("json");
    await refuseBreachedPassword(c, input.password);
    const user = await c.get("store").updateUser(id, input);
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
