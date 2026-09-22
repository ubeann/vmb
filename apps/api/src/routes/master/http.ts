import type { ValidationIssue } from "@vmb/types";
import type { MasterStore } from "@vmb/db";
import type { Context } from "hono";
import { validator } from "hono/validator";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import type { Bindings } from "../../bindings.js";

export type MasterEnv = {
  Bindings: Bindings;
  Variables: { store: MasterStore };
};

/** A request the route itself refused, before the store ever saw it. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly issues?: ValidationIssue[]
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function issuesFrom(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
}

/**
 * A JSON body validator: a failed parse is a 400 carrying the shared schema's
 * issues. Using Hono's `validator` (rather than reading `c.req.json()` by
 * hand) is what lets the RPC client infer each route's `json` input.
 */
export function jsonBody<T extends z.ZodType>(schema: T) {
  return validator("json", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Validation failed.", issues: issuesFrom(parsed.error) }, 400);
    }
    return parsed.data as z.infer<T>;
  });
}

/** Query parameters are strings; the shared list schemas coerce them. */
export function queryParams<T extends z.ZodType>(c: Context<MasterEnv>, schema: T): z.infer<T> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success)
    throw new HttpError(400, "Invalid query parameters.", issuesFrom(parsed.error));
  return parsed.data as z.infer<T>;
}

export function pathId(c: Context<MasterEnv>): string {
  const id = c.req.param("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "Invalid id.");
  }
  return id;
}
