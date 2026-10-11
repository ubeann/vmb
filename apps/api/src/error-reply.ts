import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  StaleRecordError
} from "@vmb/db";
import { ApiErrorSchema, type ApiError, type ApiErrorCode } from "@vmb/types";
import type { Context, ErrorHandler, Hono, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HttpError } from "./http.js";

/**
 * The one place an error becomes a reply (ADR-0048): every error from
 * `apps/api` is JSON `{ code, message, issues? }`. Better Auth answers its own
 * routes in the same shape before an error could reach here.
 */
function reply(
  c: Context,
  status: ContentfulStatusCode,
  code: ApiErrorCode,
  message: string,
  issues?: ApiError["issues"]
) {
  const body: ApiError = issues ? { code, message, issues } : { code, message };
  return c.json(ApiErrorSchema.parse(body), status);
}

function statusOf(error: DomainError): ContentfulStatusCode {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError || error instanceof StaleRecordError) return 409;
  if (error instanceof ForbiddenError) return 403;
  return 500;
}

const errorReply: ErrorHandler = (error, c) => {
  if (error instanceof HttpError) {
    return reply(c, error.status, error.code, error.message, error.issues);
  }
  if (error instanceof DomainError) {
    return reply(c, statusOf(error), error.code, error.message, error.issues);
  }
  // Hono's body validator throws this for a body it cannot parse as JSON.
  if (error instanceof HTTPException && error.status === 400) {
    return reply(c, 400, "MALFORMED_REQUEST", "The request body is not valid JSON.");
  }

  // never the error's own message: it is server text, not copy for a person
  console.error(`${c.req.method} ${c.req.path}: unhandled error`, error);
  return reply(c, 500, "INTERNAL", "Something went wrong. Please try again.");
};

const notFoundReply: NotFoundHandler = (c) =>
  reply(c, 404, "NOT_FOUND", "There is nothing at this address.");

/**
 * Answer every error and unknown path of `app` with the contract. Only the root
 * app calls this (and tests standing in for it): a sub-app's own handler would
 * shadow the root's, which is what left `/api/me` answering plain text.
 */
// `any`: the handlers serve every app, whatever its env and routes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorReplies<App extends Hono<any, any, any>>(app: App): App {
  // both return the app itself; returning `app` keeps the route schema `AppType` infers from
  app.onError(errorReply).notFound(notFoundReply);
  return app;
}
