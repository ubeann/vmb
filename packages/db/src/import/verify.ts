import { portedTables } from "./manifest.js";
import type { Snapshot } from "./snapshot.js";

export type Finding = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type Report = {
  errors: Finding[];
  warnings: Finding[];
  /** Rows written per table, so a refresh can be eyeballed against the source. */
  rowCounts: Record<string, number>;
  /** Per-table checksum over the business keys that exist, for parity across runs. */
  checksums: Record<string, string>;
};

export type Verifier = {
  /** How many rows the snapshot holds for a table. */
  sourceRows(table: string): number;
  /** How many rows the database holds for a table. */
  targetRows(table: string): Promise<number>;
  /** A stable checksum over the business keys present in the table. */
  checksum(table: string): Promise<string | null>;
  /** How many foreign keys point at a row that does not exist. */
  danglingForeignKeys(): Promise<number>;
};

/** The business keys the inventory identifies, used for the parity checksum. */
export const businessKeys: Record<string, string[]> = {
  "master.divisions": ["code"],
  "master.users": ["email"],
  "trucking.clients": ["code"],
  "trucking.drivers": ["code"],
  "trucking.trucks": ["license_plate"],
  "trucking.locations": ["code"],
  "trucking.orders": ["code"],
  "trucking.invoices": ["code"],
  "warehouse.items": ["code"],
  "warehouse.procurement_requests": ["request_number"],
  "warehouse.stock_requisitions": ["request_number"],
  "expense.budgets": ["division_id"],
  "expense.requests": ["request_number"]
};

export async function verify(snapshot: Snapshot, verifier: Verifier): Promise<Report> {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const rowCounts: Record<string, number> = {};
  const checksums: Record<string, string> = {};

  for (const table of portedTables) {
    const expected = verifier.sourceRows(table);
    const actual = await verifier.targetRows(table);
    rowCounts[table] = actual;

    if (actual !== expected) {
      errors.push({
        level: "error",
        code: "row-count",
        message: `${table}: snapshot has ${expected} rows, database has ${actual}`
      });
    }

    // A business-key checksum is recorded when the table has rows; an empty
    // table is normal, not a defect — a missing row is already a row-count error.
    if (businessKeys[table]) {
      const sum = await verifier.checksum(table);
      if (sum !== null) checksums[table] = sum;
    }
  }

  const dangling = await verifier.danglingForeignKeys();
  if (dangling > 0) {
    errors.push({
      level: "error",
      code: "fk-integrity",
      message: `${dangling} foreign key reference(s) point at rows that do not exist`
    });
  }

  return { errors, warnings, rowCounts, checksums };
}

/** A report that failed before any check could run. */
export function failedReport(message: string): Report {
  return {
    errors: [{ level: "error", code: "pipeline", message }],
    warnings: [],
    rowCounts: {},
    checksums: {}
  };
}

export function isClean(report: Report): boolean {
  return report.errors.length === 0 && report.warnings.length === 0;
}
