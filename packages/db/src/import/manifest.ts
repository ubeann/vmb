/**
 * What the pipeline carries, and what it deliberately leaves behind.
 *
 * The exclusions are the decisions in ADR-0024 and the ledger: Laravel runtime,
 * Laravel auth, and the Spatie RBAC tables are not ported. `master.users` is
 * ported because every domain holds foreign keys to it (ledger D-004) and the
 * identity transform (#7) needs it; the RBAC tables are retained in the raw
 * snapshot so #8's mapper can be written without another dump.
 */

/** The migration that creates the baseline every snapshot is loaded into. */
export const baselineMigrationTag = "0001_legacy_baseline";

/** Legacy tables the pipeline copies. Parents precede children. */
import { schemaOrder } from "./schema-order.js";

export const portedTables: string[] = schemaOrder;

/** Legacy tables kept out of the pipeline, with the reason. */
export const excludedTables: { table: string; reason: string }[] = [
  { table: "public.cache", reason: "Laravel runtime" },
  { table: "public.cache_locks", reason: "Laravel runtime" },
  { table: "public.jobs", reason: "Laravel runtime" },
  { table: "public.job_batches", reason: "Laravel runtime" },
  { table: "public.failed_jobs", reason: "Laravel runtime" },
  { table: "public.migrations", reason: "Laravel runtime" },
  { table: "auth.sessions", reason: "replaced by Better Auth (#7)" },
  { table: "auth.password_reset_tokens", reason: "replaced by Better Auth (#7)" },
  { table: "auth.two_factors", reason: "non-portable secrets; re-enrolment (#7)" },
  { table: "master.roles", reason: "replaced by the RBAC layer (#8); data retained" },
  { table: "master.permissions", reason: "replaced by the RBAC layer (#8); data retained" },
  { table: "spatie.model_has_roles", reason: "replaced by the RBAC layer (#8); data retained" },
  {
    table: "spatie.model_has_permissions",
    reason: "replaced by the RBAC layer (#8); data retained"
  },
  { table: "spatie.role_has_permissions", reason: "replaced by the RBAC layer (#8); data retained" }
];

/**
 * Tables whose rows may name another row in the same table.
 *
 * The foreign key is immediate, so a row cannot reference one that is not
 * inserted yet; the loader orders these rows by their references before
 * inserting them.
 */
export const selfReferences: Record<string, string> = {
  "trucking.orders": "reference_id"
};

export function isPorted(table: string): boolean {
  return portedTables.includes(table);
}

export function isExcluded(table: string): boolean {
  return excludedTables.some((excluded) => excluded.table === table);
}
