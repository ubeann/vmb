import { z } from "zod";
import { PASSWORD_BREACHED_CODE } from "./password.js";

/** One validation failure, flattened for a form or an API error body. */
export const ValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string()
});

/**
 * VMB's own error codes (ADR-0048): a generic code per status, plus a specific
 * one only where a caller branches on the reason. A code joins this list only
 * when some caller treats it differently.
 */
export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "MALFORMED_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL",
  "SYSTEM_ROLE",
  "PERMISSION_ESCALATION",
  "ROLE_IN_USE",
  PASSWORD_BREACHED_CODE
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function isApiErrorCode(code: string): code is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Every error reply from `apps/api`, auth included (ADR-0048). `code` is read
 * as any string: Better Auth sends codes of its own, and a code a client does
 * not know falls back to the generic handling for its status.
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  issues: z.array(ValidationIssueSchema).optional()
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
