import { portedTables, selfReferences } from "./manifest.js";
import type { Snapshot, SnapshotRow } from "./snapshot.js";
import type { Finding } from "./verify.js";

export type LoadPlan = {
  statements: string[];
  problems: Finding[];
};

/**
 * Statements that insert a snapshot into the baseline.
 *
 * Every value is emitted as a SQL literal, because `COPY FROM stdin` is not
 * available on every target the pipeline runs against. Rows are emitted parents
 * first — the order the foreign-key graph dictates — and the one table whose
 * rows may reference each other is ordered internally.
 */
export function loadStatements(snapshot: Snapshot): LoadPlan {
  const statements: string[] = [];
  const problems: Finding[] = [];

  for (const table of portedTables) {
    const rows = snapshot.rows.get(table);
    if (!rows?.length) continue;

    const names = snapshot.columns.get(table) as string[];
    const columns = names.map(quoteIdentifier);
    const ordered = orderSelfReferences(table, names, rows);

    ordered.forEach((row, index) => {
      if (row.length !== columns.length) {
        problems.push({
          level: "error",
          code: "row-shape",
          message: `${table}: row ${index + 1} has ${row.length} values for ${columns.length} columns`
        });
        return;
      }
      const values = row.map((value) => (value === null ? "NULL" : quoteLiteral(value)));
      statements.push(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`
      );
    });
  }

  return { statements, problems };
}

/**
 * Put a row that another row names after the row it names.
 *
 * Only one table needs this (`trucking.orders.reference_id`), and the column is
 * nullable, so a chain of references always terminates at a row with no
 * reference. A cycle would be unsatisfiable by any order, and is reported.
 */
function orderSelfReferences(table: string, columns: string[], rows: SnapshotRow[]): SnapshotRow[] {
  const key = selfReferences[table];
  if (!key) return rows;

  const keyIndex = columns.indexOf(key);
  const idIndex = columns.indexOf("id");
  if (keyIndex === -1 || idIndex === -1) return rows;

  const idOf = (row: SnapshotRow): string | null => row[idIndex] ?? null;
  const referenceOf = (row: SnapshotRow): string | null => row[keyIndex] ?? null;

  const ids = new Set<string>();
  for (const row of rows) {
    const id = idOf(row);
    if (id !== null) ids.add(id);
  }

  const ordered: SnapshotRow[] = [];
  const placed = new Set<string>();
  const pending = [...rows];

  while (pending.length > 0) {
    const ready = pending.filter((row) => {
      const reference = referenceOf(row);
      return reference === null || !ids.has(reference) || placed.has(reference);
    });

    if (ready.length === 0) {
      throw new Error(`${table}: ${pending.length} row(s) form a cycle through ${key}`);
    }

    for (const row of ready) {
      ordered.push(row);
      pending.splice(pending.indexOf(row), 1);
      const id = idOf(row);
      if (id !== null) placed.add(id);
    }
  }

  return ordered;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * A SQL string literal. `standard_conforming_strings` is on, so a backslash is
 * an ordinary character: doubling the single quote is the whole job. Control
 * characters are emitted as they are, because escaping them with a backslash
 * would store the backslash instead of the character.
 */
function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
