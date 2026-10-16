import { dateFilterRange, todayIn } from "@vmb/types";
import { and, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { DatabaseSchema } from "../schema/index.js";
import { ConflictError } from "../errors.js";

/**
 * The database surface the Master store speaks to: Drizzle's query builders
 * that both the Neon HTTP driver (production, previews) and embedded PGlite
 * (tests) implement. `batch` is deliberately not used, so the same store runs
 * on both; and the HTTP driver has no interactive transactions, so a use case
 * that needs one asks an `OpenTransaction` for it instead (ADR-0049).
 */
export type MasterDb = PgDatabase<PgQueryResultHKT, DatabaseSchema>;

/**
 * Run `work` in one transaction: committed when it resolves, rolled back when
 * it throws. The store receives this as a dependency, so it never names a
 * driver: the Worker opens a Neon WebSocket connection for it, tests use
 * PGlite's `db.transaction` (ADR-0049).
 */
export type OpenTransaction = <T>(work: (tx: MasterDb) => Promise<T>) => Promise<T>;

/** Timestamps reach the store as `Date`s and leave as ISO strings on the wire. */
export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Whether a row still carries the `updatedAt` its editor loaded, for the
 * `where` of the update itself: the check and the write are one statement, so
 * an edit saved in between cannot be overwritten. The columns keep
 * milliseconds and the API serves them whole, so an unchanged row compares
 * equal; a row never stamped is `null` and matches the `null` its editor read.
 */
export function unchangedSince(column: AnyColumn, updatedAt: string | null): SQL {
  return sql`${column} is not distinct from ${updatedAt}::timestamptz`;
}

/**
 * The `updated_at` a save writes: the database's clock, but never the stamp it
 * replaces. The columns keep milliseconds, so two saves inside one millisecond
 * would otherwise leave the stamp an earlier editor still holds, and that
 * editor's save would pass `unchangedSince`.
 */
export function nextStamp(column: AnyColumn): SQL {
  return sql`greatest(now(), ${column} + interval '1 millisecond')`;
}

/**
 * Rows stamped on one of the days a date filter covers, in the reader's zone:
 * from that zone's midnight at the start of `from` to its midnight after `to`.
 * A row with no stamp is on no day.
 */
export function withinDays(column: AnyColumn, value: string | undefined, tz: string) {
  const range = dateFilterRange(value, todayIn(tz));
  if (!range) return undefined;
  return and(
    sql`${column} >= (${range.from}::date)::timestamp at time zone ${tz}`,
    sql`${column} < (${range.to}::date + 1)::timestamp at time zone ${tz}`
  );
}

/** Rows matching every condition given, as a count the driver hands back as a number. */
export function countWhere(...conditions: (SQL | undefined)[]) {
  const where = and(...conditions) ?? sql`true`;
  return sql<number>`cast(count(*) filter (where ${where}) as integer)`.mapWith(Number);
}

/** The rows a raw `db.execute` returned, whichever driver ran it. */
export function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
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

/** The field a unique constraint guards, and what the admin should read on it. */
export type UniqueField = { path: string; message: string };

/**
 * Translate a unique-constraint violation into a conflict naming the field it
 * is about, so a form shows the message on that field (ADR-0048), falling back
 * to a generic one when the driver does not name the constraint. Anything that
 * is not a unique violation is rethrown untouched.
 */
export function conflictFrom(error: unknown, byConstraint: Record<string, UniqueField>): never {
  if (!isUniqueViolation(error)) throw error;

  const constraint = pgError(error)?.constraint;
  const field = typeof constraint === "string" ? byConstraint[constraint] : undefined;

  throw field ? new ConflictError(field.message, { issues: [field] }) : new ConflictError();
}
