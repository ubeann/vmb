import type { ApiErrorCode, ValidationIssue } from "@vmb/types";

/**
 * The errors a store throws for a refusal the caller should hear about
 * (ADR-0048). Each carries its API code and is module-neutral, so every domain
 * module reuses these; `apps/api` maps each class to its status in one place.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ApiErrorCode;

  constructor(
    message: string,
    readonly issues?: ValidationIssue[]
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** A record the caller named does not exist. */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";

  constructor(message = "Record not found.") {
    super(message);
  }
}

/**
 * The change clashes with data already stored. A unique-value conflict names
 * its field in `issues`, so a form can show the message on that field.
 */
export class ConflictError extends DomainError {
  readonly code: Extract<ApiErrorCode, "CONFLICT" | "ROLE_IN_USE">;

  constructor(
    message = "That value is already taken.",
    options: {
      issues?: ValidationIssue[];
      code?: Extract<ApiErrorCode, "CONFLICT" | "ROLE_IN_USE">;
    } = {}
  ) {
    super(message, options.issues);
    this.code = options.code ?? "CONFLICT";
  }
}

/** The caller may not do this to this record, whatever their permissions. */
export class ForbiddenError extends DomainError {
  constructor(
    readonly code: Extract<ApiErrorCode, "SYSTEM_ROLE" | "PERMISSION_ESCALATION">,
    message: string
  ) {
    super(message);
  }
}
