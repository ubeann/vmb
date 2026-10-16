import {
  type BulkRequest,
  type BulkResponse,
  type Division,
  type DivisionDetail,
  type DivisionInput,
  type DivisionListRequest,
  type DivisionListResponse,
  type DivisionUpdateInput
} from "@vmb/types";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
  sql,
  type SQL
} from "drizzle-orm";
import { divisions, roles, users } from "../schema/master.js";
import {
  conflictFrom,
  countWhere,
  nextStamp,
  nullIfEmpty,
  toIso,
  unchangedSince,
  withinDays,
  type MasterDb,
  type OpenTransaction
} from "./db.js";
import { uniqueIds } from "./guards.js";
import { inDivision } from "./users.js";
import { ConflictError, NotFoundError, StaleRecordError } from "../errors.js";

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

/**
 * A division with its user count: the Users not in the Trash who hold a role
 * scoped to it, each once however many such roles they hold. A Trashed
 * division still counts, so its restore can say who it brings back.
 */
export async function getDivision(db: MasterDb, id: string): Promise<DivisionDetail> {
  const [rows, members] = await Promise.all([
    db.select().from(divisions).where(eq(divisions.id, id)).limit(1),
    db
      .select({ value: count() })
      .from(users)
      .where(and(isNull(users.deletedAt), inDivision(id)))
  ]);
  const row = rows[0];
  if (!row) throw new NotFoundError("Division not found.");
  return { ...toDivision(row), userCount: members[0]?.value ?? 0 };
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

/**
 * Save an edit, if the division is live and still as the editor loaded it:
 * `deletedAt` and `input.updatedAt` are both checked inside the update, so
 * neither a delete nor a save in between can be overwritten (a Trashed division
 * is read-only until it is restored, ADR-0055). A miss is a 404 when the
 * division is missing or Trashed, and a 409 when it is live but has changed.
 */
export async function updateDivision(
  db: MasterDb,
  id: string,
  input: DivisionUpdateInput
): Promise<Division> {
  const { updatedAt, ...fields } = input;

  try {
    const rows = await db
      .update(divisions)
      .set({
        ...fields,
        description: nullIfEmpty(fields.description),
        updatedAt: nextStamp(divisions.updatedAt)
      })
      .where(
        and(
          eq(divisions.id, id),
          isNull(divisions.deletedAt),
          unchangedSince(divisions.updatedAt, updatedAt)
        )
      )
      .returning();
    const row = rows[0];
    if (row) return toDivision(row);
  } catch (error) {
    return conflictFrom(error, DIVISION_CONFLICTS);
  }

  // a Trashed division is not stale, it is out of reach: reloading would not help
  const found = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(and(eq(divisions.id, id), isNull(divisions.deletedAt)))
    .limit(1);
  if (!found[0]) throw new NotFoundError("Division not found.");
  throw new StaleRecordError();
}

/**
 * Switch a live division on or off. It writes `is_active` and `updated_at` and
 * nothing else, so a row's Activate or Deactivate cannot overwrite a field
 * someone else is editing, as a whole-record update would. A Trashed division
 * is not switched: it comes back with Restore first (ADR-0055). `updated_at`
 * moves only when the flag changes.
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

/**
 * Move a live division to the Trash, unless a role still belongs to it: a
 * Trashed division keeps its roles attached, and everyone holding them would
 * keep every permission while the division dropped out of their `/me` (#406,
 * ADR-0055). Roles do not soft-delete, so any role row counts. The refusal is
 * in the update's own `where`, not a read ahead of it. One role committing in the instant
 * between that statement's snapshot and its write can still be missed: Postgres lets a role's
 * foreign-key lock and this update run side by side (ADR-0055).
 * A miss is a 404 when the division is missing or already Trashed, and a 409
 * `DIVISION_IN_USE` when it is live and has roles.
 */
export async function deleteDivision(db: MasterDb, id: string): Promise<void> {
  const rows = await db
    .update(divisions)
    // a stamp an editor still holds is never reissued, so its save is stale (as after a save)
    .set({ deletedAt: new Date(), updatedAt: nextStamp(divisions.updatedAt) })
    .where(
      and(
        eq(divisions.id, id),
        isNull(divisions.deletedAt),
        not(
          exists(
            db
              .select({ one: sql`1` })
              .from(roles)
              .where(eq(roles.divisionId, divisions.id))
          )
        )
      )
    )
    .returning({ id: divisions.id });

  if (rows[0]) return;

  // only the refusal's wording comes from this read: the delete itself was decided above
  const live = await db
    .select({ roles: count(roles.id) })
    .from(divisions)
    .leftJoin(roles, eq(roles.divisionId, divisions.id))
    .where(and(eq(divisions.id, id), isNull(divisions.deletedAt)))
    .groupBy(divisions.id);
  const held = live[0]?.roles;
  if (held === undefined) throw new NotFoundError("Division not found.");
  // the last role left between the delete and this read: nothing is refused now, so say to retry
  if (held === 0) {
    throw new ConflictError("This division changed while it was being deleted. Try again.");
  }

  throw new ConflictError(
    held === 1
      ? "1 role belongs to this division. Move it to another division or delete it first."
      : `${held} roles belong to this division. Move them to another division or delete them first.`,
    { code: "DIVISION_IN_USE" }
  );
}

export async function restoreDivision(db: MasterDb, id: string): Promise<Division> {
  try {
    const rows = await db
      .update(divisions)
      .set({ deletedAt: null, updatedAt: nextStamp(divisions.updatedAt) })
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

/** “Alpha” (1 role), “Beta” (2 roles): what a refusal says about the divisions it names. */
function withRoles(rows: { name: string; roles: number }[]): string {
  return rows
    .map((row) => `“${row.name}” (${row.roles} ${row.roles === 1 ? "role" : "roles"})`)
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

/**
 * Delete or restore several divisions as one: all of them or none, in one
 * transaction (#305). A refusal is read over the whole batch, so it names every
 * division in the way: those that still have roles (`DIVISION_IN_USE`, with
 * how many each), or a 404 when one is gone or not where the action needs it.
 * The write repeats the rules in its own `where`, as the single delete does,
 * so a division that changed since the read fails the batch too (ADR-0055).
 */
export async function bulkDivisions(
  options: { transaction: OpenTransaction },
  request: BulkRequest
): Promise<BulkResponse> {
  const ids = uniqueIds(request.ids);
  return options.transaction((tx) =>
    request.action === "delete" ? bulkDeleteDivisions(tx, ids) : bulkRestoreDivisions(tx, ids)
  );
}

async function bulkDeleteDivisions(tx: MasterDb, ids: string[]): Promise<BulkResponse> {
  const found = await tx
    .select({ id: divisions.id, name: divisions.name, roles: count(roles.id) })
    .from(divisions)
    .leftJoin(roles, eq(roles.divisionId, divisions.id))
    .where(and(inArray(divisions.id, ids), isNull(divisions.deletedAt)))
    .groupBy(divisions.id);
  if (found.length !== ids.length) {
    throw new NotFoundError(
      "Some of the selected divisions are gone or already in the Trash. Reload the list and try again."
    );
  }

  const busy = found.filter((row) => row.roles > 0);
  if (busy.length > 0) {
    throw new ConflictError(
      `${busy.length} of the ${ids.length} selected ${ids.length === 1 ? "division" : "divisions"} still ${busy.length === 1 ? "has" : "have"} roles: ${withRoles(busy)}. Move ${busy.length === 1 && busy[0]?.roles === 1 ? "that role" : "those roles"} to another division or delete them, then try again. Nothing was deleted.`,
      { code: "DIVISION_IN_USE" }
    );
  }

  const rows = await tx
    .update(divisions)
    .set({ deletedAt: new Date(), updatedAt: nextStamp(divisions.updatedAt) })
    .where(
      and(
        inArray(divisions.id, ids),
        isNull(divisions.deletedAt),
        not(
          exists(
            tx
              .select({ one: sql`1` })
              .from(roles)
              .where(eq(roles.divisionId, divisions.id))
          )
        )
      )
    )
    .returning({ id: divisions.id });
  if (rows.length !== ids.length) {
    throw new ConflictError("Some divisions changed while they were being deleted. Try again.");
  }
  return { ids: rows.map((row) => row.id) };
}

async function bulkRestoreDivisions(tx: MasterDb, ids: string[]): Promise<BulkResponse> {
  let rows: { id: string }[];
  try {
    rows = await tx
      .update(divisions)
      .set({ deletedAt: null, updatedAt: nextStamp(divisions.updatedAt) })
      .where(and(inArray(divisions.id, ids), isNotNull(divisions.deletedAt)))
      .returning({ id: divisions.id });
  } catch (error) {
    // a name or code may have been taken while they were Trashed
    return conflictFrom(error, DIVISION_CONFLICTS);
  }
  if (rows.length !== ids.length) {
    throw new NotFoundError(
      "Some of the selected divisions are gone or no longer in the Trash. Reload the list and try again."
    );
  }
  return { ids: rows.map((row) => row.id) };
}
