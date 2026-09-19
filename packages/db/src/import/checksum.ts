import { createHash } from "node:crypto";

/**
 * A checksum over the business keys of a set of rows.
 *
 * Both sides of the parity check — the snapshot and the database — are reduced
 * here, in one place, so the comparison is between data rather than between two
 * spellings of the same query. Rows are sorted before hashing, because row order
 * is not part of what the checksum claims to prove.
 */
const nullToken = "\u0000";
const fieldSeparator = "\u0001";
const rowSeparator = "\u0002";

export function checksumRows(rows: (string | null)[][]): string {
  const encoded = rows
    .map((row) => row.map((value) => value ?? nullToken).join(fieldSeparator))
    .sort()
    .join(rowSeparator);

  return createHash("sha256").update(encoded).digest("hex");
}

/**
 * Pick the business-key columns out of a snapshot row.
 *
 * The snapshot carries a column list per table, so the keys are found by name
 * rather than by position — the dump's column order is not part of the contract.
 */
export function pickKeys(
  columns: string[],
  row: (string | null)[],
  keys: string[]
): (string | null)[] {
  return keys.map((key) => {
    const index = columns.indexOf(key);
    if (index === -1) {
      throw new Error(`the snapshot has no column "${key}"`);
    }
    return row[index] ?? null;
  });
}
