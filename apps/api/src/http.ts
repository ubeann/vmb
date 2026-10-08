import type { ApiErrorCode, ValidationIssue } from "@vmb/types";
import type { Context } from "hono";
import { validator } from "hono/validator";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

/**
 * A request the API refused before any store saw it. The root error handler
 * (`./error-reply.ts`) answers it with its own status and code.
 */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ApiErrorCode,
    message: string,
    readonly issues?: ValidationIssue[]
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function issuesFrom(error: z.ZodError): ValidationIssue[] {
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
  return validator("json", (value) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION_FAILED", "Validation failed.", issuesFrom(parsed.error));
    }
    return parsed.data as z.infer<T>;
  });
}

/** Query parameters are strings; the shared list schemas coerce them. */
export function queryParams<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_FAILED",
      "Invalid query parameters.",
      issuesFrom(parsed.error)
    );
  }
  return parsed.data as z.infer<T>;
}

export function pathId(c: Context): string {
  const id = c.req.param("id");
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_FAILED", "Invalid id.");
  return parsed.data;
}
