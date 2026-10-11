import {
  dateFilterRange,
  todayIn,
  type Division,
  type DivisionInput,
  type DivisionListRequest,
  type DivisionListResponse
} from "@vmb/types";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type AnyColumn,
  type SQL
} from "drizzle-orm";
import { divisions } from "../schema/master.js";
import { conflictFrom, nullIfEmpty, toIso, type MasterDb } from "./db.js";
import { NotFoundError } from "../errors.js";

const DIVISION_CONFLICTS = {
  master_divisions_name_unique: {
    path: "name",
    message: "A division with that name already exists."
  },
  master_divisions_code_unique: {
    path: "code",
    message: "A division with that code already exists."
  }
};

type DivisionRow = typeof divisions.$inferSelect;

const SORT_COLUMNS = {
  name: divisions.name,
  code: divisions.code,
  createdAt: divisions.createdAt,
  updatedAt: divisions.updatedAt
} as const;

function toDivision(row: DivisionRow): Division {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    colorHex: row.colorHex,
    iconName: row.iconName,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    deletedAt: toIso(row.deletedAt)
  };
}

/**
 * Rows stamped on one of the days a date filter covers, in the reader's zone:
 * from that zone's midnight at the start of `from` to its midnight after `to`.
 * A row with no stamp is on no day.
 */
function withinDays(column: AnyColumn, value: string | undefined, tz: string) {
  const range = dateFilterRange(value, todayIn(tz));
  if (!range) return undefined;
  return and(
    sql`${column} >= (${range.from}::date)::timestamp at time zone ${tz}`,
    sql`${column} < (${range.to}::date + 1)::timestamp at time zone ${tz}`
  );
}

/** The search and every filter but the view and the status, which the counts vary. */
function sharedConditions(query: DivisionListRequest): SQL[] {
  const conditions: SQL[] = [];

  if (query.search) {
    const pattern = `%${query.search}%`;
    const matches = or(
      ilike(divisions.name, pattern),
      ilike(divisions.code, pattern),
      ilike(divisions.description, pattern)
    );
    if (matches) conditions.push(matches);
  }
  const updated = withinDays(divisions.updatedAt, query.updated, query.tz);
  if (updated) conditions.push(updated);
  const created = withinDays(divisions.createdAt, query.created, query.tz);
  if (created) conditions.push(created);

  return conditions;
}

function viewCondition(trashed: DivisionListRequest["trashed"]): SQL | undefined {
  if (trashed === "exclude") return isNull(divisions.deletedAt);
  if (trashed === "only") return isNotNull(divisions.deletedAt);
  return undefined;
}

/** None chosen is any; both chosen is any too, but stays a condition the counts can share. */
function statusCondition(status: DivisionListRequest["status"]): SQL | undefined {
  if (status.length === 0) return undefined;
  return inArray(
    divisions.isActive,
    status.map((value) => value === "active")
  );
}

/** Rows matching every condition given, as a count the driver hands back as a number. */
function countWhere(...conditions: (SQL | undefined)[]) {
  const where = and(...conditions) ?? sql`true`;
  return sql<number>`cast(count(*) filter (where ${where}) as integer)`.mapWith(Number);
}

/**
 * A page of the list, with the counts the list kit shows: each view's rows
 * and each Status option's rows in the current view, all keeping the search
 * and the other filters (ADR-0051 rules 2 and 4). The counts come from one
 * aggregate over the rows the shared conditions match.
 */
export async function listDivisions(
  db: MasterDb,
  query: DivisionListRequest
): Promise<DivisionListResponse> {
  const shared = sharedConditions(query);
  const view = viewCondition(query.trashed);
  const status = statusCondition(query.status);
  const column = SORT_COLUMNS[query.sort];
  const order = query.dir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(divisions)
      .where(and(...shared, view, status))
      .orderBy(order, asc(divisions.id))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    db
      .select({
        total: countWhere(view, status),
        all: countWhere(isNull(divisions.deletedAt), status),
        trash: countWhere(isNotNull(divisions.deletedAt), status),
        active: countWhere(view, eq(divisions.isActive, true)),
        inactive: countWhere(view, eq(divisions.isActive, false))
      })
      .from(divisions)
      .where(and(...shared))
  ]);
  const counts = totals[0] ?? { total: 0, all: 0, trash: 0, active: 0, inactive: 0 };

  return {
    items: rows.map(toDivision),
    total: counts.total,
    page: query.page,
    perPage: query.perPage,
    views: { all: counts.all, trash: counts.trash },
    facets: { status: { active: counts.active, inactive: counts.inactive } }
  };
}

export async function getDivision(db: MasterDb, id: string): Promise<Division> {
  const rows = await db.select().from(divisions).where(eq(divisions.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError("Division not found.");
  return toDivision(row);
}

export async function createDivision(db: MasterDb, input: DivisionInput): Promise<Division> {
  try {
    const stamp = new Date();
    const rows = await db
      .insert(divisions)
      .values({
        ...input,
        description: nullIfEmpty(input.description),
        createdAt: stamp,
        updatedAt: stamp
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("creating a division returned no row");
    return toDivision(row);
  } catch (error) {
    return conflictFrom(error, DIVISION_CONFLICTS);
  }
}

export async function updateDivision(
  db: MasterDb,
  id: string,
  input: DivisionInput
): Promise<Division> {
  try {
    const rows = await db
      .update(divisions)
      .set({ ...input, description: nullIfEmpty(input.description), updatedAt: new Date() })
      .where(eq(divisions.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundError("Division not found.");
    return toDivision(row);
  } catch (error) {
    return conflictFrom(error, DIVISION_CONFLICTS);
  }
}

/**
 * Switch a live division on or off. It writes `is_active` and `updated_at` and
 * nothing else, so a row's Activate or Deactivate cannot overwrite a field
 * someone else is editing, as a whole-record update would. A Trashed division
 * is not switched: it comes back with Restore first. `updated_at` moves only
 * when the flag changes.
 */
export async function setDivisionActive(
  db: MasterDb,
  id: string,
  isActive: boolean
): Promise<Division> {
  const rows = await db
    .update(divisions)
    // "Updated" moves only when the flag does, so a double click or an Undo of nothing leaves it alone
    .set({
      isActive,
      updatedAt: sql`case when ${divisions.isActive} is distinct from ${isActive} then now() else ${divisions.updatedAt} end`
    })
    .where(and(eq(divisions.id, id), isNull(divisions.deletedAt)))
    .returning();

  const row = rows[0];
  if (!row) throw new NotFoundError("Division not found.");
  return toDivision(row);
}

export async function deleteDivision(db: MasterDb, id: string): Promise<void> {
  const rows = await db
    .update(divisions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(divisions.id, id), isNull(divisions.deletedAt)))
    .returning({ id: divisions.id });

  if (!rows[0]) throw new NotFoundError("Division not found.");
}

export async function restoreDivision(db: MasterDb, id: string): Promise<Division> {
  try {
    const rows = await db
      .update(divisions)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(divisions.id, id), isNotNull(divisions.deletedAt)))
      .returning();

    const row = rows[0];
    if (!row) throw new NotFoundError("Deleted division not found.");
    return toDivision(row);
  } catch (error) {
    // its name or code may have been taken while it was Trashed
    return conflictFrom(error, DIVISION_CONFLICTS);
  }
}
