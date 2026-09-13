import { createDb, sql } from "@vmb/db";
import { HealthResponseSchema, type HealthResponse } from "@vmb/types";
import { Hono } from "hono";
import type { Bindings } from "../bindings.js";

export const healthRoute = new Hono<{ Bindings: Bindings }>().get("/", async (c) => {
  const timestamp = new Date().toISOString();

  let connected: boolean;
  try {
    await createDb(c.env.DATABASE_URL).execute(sql`select 1`);
    connected = true;
  } catch (err) {
    console.error("health check: db unreachable", err);
    connected = false;
  }

  const body: HealthResponse = connected
    ? { status: "ok", db: "connected", timestamp }
    : { status: "error", db: "unreachable", timestamp };

  return c.json(HealthResponseSchema.parse(body), connected ? 200 : 503);
});
