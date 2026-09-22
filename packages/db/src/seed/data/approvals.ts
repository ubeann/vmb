import { table, type SeedTable, type SqlLiteral } from "../sql.js";

/**
 * `trucking`, `warehouse` and `expense` each have an `approvals` table with the
 * same nine columns — distinct concepts that share a name (CONTEXT.md), but
 * one shape. Sharing the column list keeps the three inserts from drifting.
 */
export const approvalColumns = [
  "id",
  "approvable_type",
  "approvable_id",
  "approver_id",
  "type",
  "approved",
  "comment",
  "created_at",
  "updated_at"
] as const;

export type ApprovalRow = Record<(typeof approvalColumns)[number], SqlLiteral>;

export function approvalTable(name: string, rows: readonly ApprovalRow[]): SeedTable {
  return table(name, approvalColumns, rows);
}
