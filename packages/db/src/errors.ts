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

/**
 * A record the caller named does not exist. One a field names, such as a
 * role's Division, says which in `issues`, so a form shows it on that field.
 */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";

  constructor(message = "Record not found.", path?: string) {
    super(message, path ? [{ path, message }] : undefined);
  }
}

/**
 * The change clashes with data already stored. A unique-value conflict names
 * its field in `issues`, so a form can show the message on that field.
 */
export class ConflictError extends DomainError {
  readonly code: Extract<ApiErrorCode, "CONFLICT" | "ROLE_IN_USE" | "DIVISION_IN_USE">;

  constructor(
    message = "That value is already taken.",
    options: {
      issues?: ValidationIssue[];
      code?: Extract<ApiErrorCode, "CONFLICT" | "ROLE_IN_USE" | "DIVISION_IN_USE">;
    } = {}
  ) {
    super(message, options.issues);
    this.code = options.code ?? "CONFLICT";
  }
}

/**
 * An edit was made over a record that changed since the editor loaded it. It
 * names `updatedAt`, so a form can show the line beside its hidden stamp
 * (ADR-0048's field issues).
 */
export class StaleRecordError extends DomainError {
  readonly code = "STALE_RECORD";

  constructor(message = "This record was changed by someone else since you opened it.") {
    super(message, [{ path: "updatedAt", message }]);
  }
}

/** The caller may not do this, whatever their permissions: to this record, or with an account that has no place in the app. */
export class ForbiddenError extends DomainError {
  constructor(
    readonly code: Extract<ApiErrorCode, "FORBIDDEN" | "SYSTEM_ROLE" | "PERMISSION_ESCALATION">,
    message: string
  ) {
    super(message);
  }
}

/**
 * The change breaks a rule of the domain that no single field's shape can
 * say, such as giving a user a role of an Inactive Division. It names the
 * field it is about in `issues`, so a form shows the message there.
 */
export class RuleBrokenError extends DomainError {
  readonly code = "VALIDATION_FAILED";

  constructor(message: string, path: string) {
    super(message, [{ path, message }]);
  }
}
