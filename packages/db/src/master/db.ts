import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { DatabaseSchema } from "../schema/index.js";
import { MasterConflictError } from "./errors.js";

/**
 * The database surface the Master store speaks to: Drizzle's query builders
 * that both the Neon HTTP driver (production, previews) and embedded PGlite
 * (tests) implement. Driver-only features — `batch`, interactive
 * transactions — are deliberately not used, so the same store runs on both.
 */
export type MasterDb = PgDatabase<PgQueryResultHKT, DatabaseSchema>;

/** Timestamps reach the store as `Date`s and leave as ISO strings on the wire. */
export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** A form's empty string is the database's null. */
export function nullIfEmpty(value: string): string | null {
  return value === "" ? null : value;
}

type PgError = {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
};

/**
 * Drizzle wraps a driver error in a `DrizzleQueryError` of its own, so the
 * Postgres fields (`code`, `constraint`) sit on the `cause` chain rather than
 * the thrown error; walk it to find the first link that is a Postgres error.
 */
function pgError(error: unknown): PgError | undefined {
  let candidate: unknown = error;
  for (let depth = 0; depth < 5 && candidate; depth += 1) {
    if (typeof candidate === "object" && candidate !== null && "code" in candidate) {
      return candidate as PgError;
    }
    candidate = (candidate as { cause?: unknown }).cause;
  }
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = pgError(error);
  if (!candidate) return false;
  if (candidate.code === "23505") return true;
  return typeof candidate.message === "string" && candidate.message.includes("duplicate key value");
}

/**
 * Translate a unique-constraint violation into the message the admin should
 * see, falling back to a generic one when the driver does not name the
 * constraint. Anything that is not a unique violation is rethrown untouched.
 */
export function conflictFrom(error: unknown, byConstraint: Record<string, string>): never {
  if (!isUniqueViolation(error)) throw error;

  const constraint = pgError(error)?.constraint;
  const message =
    (typeof constraint === "string" ? byConstraint[constraint] : undefined) ??
    "That value is already taken.";

  throw new MasterConflictError(message);
}
