import type { Division, DivisionInput, DivisionListQuery, DivisionListResponse } from "@vmb/types";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import { divisions } from "../schema/master.js";
import { conflictFrom, nullIfEmpty, toIso, type MasterDb } from "./db.js";
import { MasterNotFoundError } from "./errors.js";

const DIVISION_CONFLICTS = {
  master_divisions_name_unique: "A division with that name already exists.",
  master_divisions_code_unique: "A division with that code already exists."
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

function whereFor(query: DivisionListQuery) {
  const conditions: SQL[] = [];

  if (query.trashed === "exclude") conditions.push(isNull(divisions.deletedAt));
  if (query.trashed === "only") conditions.push(isNotNull(divisions.deletedAt));
  if (query.status === "active") conditions.push(eq(divisions.isActive, true));
  if (query.status === "inactive") conditions.push(eq(divisions.isActive, false));
  if (query.search) {
    const pattern = `%${query.search}%`;
    const matches = or(
      ilike(divisions.name, pattern),
      ilike(divisions.code, pattern),
      ilike(divisions.description, pattern)
    );
    if (matches) conditions.push(matches);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listDivisions(
  db: MasterDb,
  query: DivisionListQuery
): Promise<DivisionListResponse> {
  const where = whereFor(query);
  const column = SORT_COLUMNS[query.sort];
  const order = query.dir === "asc" ? asc(column) : desc(column);

  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(divisions)
      .where(where)
      .orderBy(order, asc(divisions.id))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    db.select({ value: count() }).from(divisions).where(where)
  ]);

  return {
    items: rows.map(toDivision),
    total: totals[0]?.value ?? 0,
    page: query.page,
    perPage: query.perPage
  };
}

export async function getDivision(db: MasterDb, id: string): Promise<Division> {
  const rows = await db.select().from(divisions).where(eq(divisions.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new MasterNotFoundError("Division not found.");
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
    if (!row) throw new MasterNotFoundError("Division not found.");
    return toDivision(row);
  } catch (error) {
    return conflictFrom(error, DIVISION_CONFLICTS);
  }
}

export async function deleteDivision(db: MasterDb, id: string): Promise<void> {
  const rows = await db
    .update(divisions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(divisions.id, id), isNull(divisions.deletedAt)))
    .returning({ id: divisions.id });

  if (!rows[0]) throw new MasterNotFoundError("Division not found.");
}

export async function restoreDivision(db: MasterDb, id: string): Promise<Division> {
  try {
    const rows = await db
      .update(divisions)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(divisions.id, id), isNotNull(divisions.deletedAt)))
      .returning();

    const row = rows[0];
    if (!row) throw new MasterNotFoundError("Deleted division not found.");
    return toDivision(row);
  } catch (error) {
    // its name or code may have been taken while it was Trashed
    return conflictFrom(error, DIVISION_CONFLICTS);
  }
}
