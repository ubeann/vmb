/**
 * The small amount of SQL assembly the preview fixtures need.
 *
 * Everything in the dataset is a code-owned literal, so statements are built
 * by quoting values, not by binding parameters — `SqlClient` carries no
 * parameter list, and the alternative (a driver per target) would make the
 * seeder unreachable from the tests' embedded Postgres.
 */
export type SqlLiteral = string | number | boolean | null | { json: unknown };

export type SeedRow = Record<string, SqlLiteral>;

export type SeedTable = {
  name: string;
  columns: readonly string[];
  rows: readonly SeedRow[];
};

/**
 * Declare a table's rows. The column tuple is the source of truth for both the
 * `insert` column list and the row shape: a row with a missing or misspelled
 * key fails `tsc`, so the dataset cannot silently drift from its statement.
 */
export function table<const C extends readonly string[]>(
  name: string,
  columns: C,
  rows: ReadonlyArray<Record<C[number], SqlLiteral>>
): SeedTable {
  return { name, columns, rows };
}

export function insertStatement({ name, columns, rows }: SeedTable): string {
  const header = `insert into ${qualified(name)} (${columns.join(", ")}) values`;
  const values = rows.map(
    (row) => `  (${columns.map((column) => literal(value(row, column, name))).join(", ")})`
  );
  return `${header}\n${values.join(",\n")};`;
}

/** Quote each part of a dotted name, so the dataset never carries quoting itself. */
function qualified(name: string): string {
  return name
    .split(".")
    .map((part) => `"${part}"`)
    .join(".");
}

function value(row: SeedRow, column: string, name: string): SqlLiteral {
  const found = row[column];
  if (found === undefined) {
    throw new Error(`${name}.${column} is missing from a seed row`);
  }
  return found;
}

function literal(value: SqlLiteral): string {
  if (value === null) return "null";
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `'${JSON.stringify(value.json).replaceAll("'", "''")}'::json`;
}
