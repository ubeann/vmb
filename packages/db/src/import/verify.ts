import { checksumRows, pickKeys } from "./checksum.js";
import type { SqlClient } from "./client.js";
import { isExcluded, isPorted, portedTables } from "./manifest.js";
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
  /** Business-key checksum per table, compared between snapshot and database. */
  checksums: Record<string, string>;
};

/** Compare one table's business keys between the snapshot and the database. */
type KeyComparison = {
  checksum: string;
  matches: boolean;
};

/**
 * The business keys the inventory identifies, used for the parity checksum.
 *
 * Keys must be text-like columns: the checksum compares the snapshot's raw text
 * against the database's `::text` rendering, so a key that renders differently
 * (a boolean, a timestamp with a time zone) would compare unequal for reasons
 * that have nothing to do with parity.
 */
export const businessKeys: Record<string, string[]> = {
  "master.divisions": ["code"],
  "master.users": ["email"],
  "trucking.clients": ["code"],
  "trucking.drivers": ["license_number"],
  "trucking.trucks": ["license_plate"],
  "trucking.locations": ["code"],
  "trucking.orders": ["code"],
  // no natural key on these two, so the checksum falls back to identity
  "trucking.invoices": ["id"],
  "expense.requests": ["id"],
  "warehouse.items": ["code"],
  "warehouse.procurement_requests": ["request_number"],
  "warehouse.stock_requisitions": ["requisition_number"],
  "expense.budgets": ["division_id"]
};

export async function verify(snapshot: Snapshot, client: SqlClient): Promise<Report> {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const rowCounts: Record<string, number> = {};
  const checksums: Record<string, string> = {};

  for (const table of portedTables) {
    const source = snapshot.rows.get(table)?.length ?? 0;
    const target = await rowCount(client, table);
    rowCounts[table] = target;

    if (target !== source) {
      errors.push({
        level: "error",
        code: "row-count",
        message: `${table}: snapshot has ${source} rows, database has ${target}`
      });
    }

    // a table the snapshot never mentions has nothing to compare
    const columns = snapshot.columns.get(table);
    if (!columns) continue;

    // a configured key the snapshot does not carry is a bug in the manifest,
    // not a crash: report it and check the rest
    const keys = businessKeys[table];
    const absent = keys?.filter((key) => !columns.includes(key)) ?? [];
    if (keys && absent.length) {
      errors.push({
        level: "error",
        code: "business-key",
        message: `${table}: the snapshot has no column ${absent.join(", ")} for the configured business key`
      });
    } else if (keys) {
      const comparison = await compareBusinessKeys(snapshot, client, table, keys, columns);
      checksums[table] = comparison.checksum;
      if (!comparison.matches) {
        errors.push({
          level: "error",
          code: "checksum",
          message: `${table}: business keys differ from the snapshot`
        });
      }
    }

    const drifted = await compareInstant(snapshot, client, table, columns);
    if (drifted > 0) {
      errors.push({
        level: "error",
        code: "instant",
        message: `${table}: ${drifted} created_at value(s) are not the instant their wall-clock named`
      });
    }
  }

  for (const table of snapshot.rows.keys()) {
    if (!isPorted(table) && !isExcluded(table)) {
      warnings.push({
        level: "warning",
        code: "unknown-table",
        message: `${table}: in the snapshot but not in the pipeline's manifest`
      });
    }
  }

  const orphans = await countOrphanedRows(client);
  if (orphans.total > 0) {
    errors.push({
      level: "error",
      code: "fk-integrity",
      message: `${orphans.total} row(s) reference a parent that does not exist — e.g. ${orphans.example}`
    });
  }

  return { errors, warnings, rowCounts, checksums };
}

async function compareBusinessKeys(
  snapshot: Snapshot,
  client: SqlClient,
  table: string,
  keys: string[],
  columns: string[]
): Promise<KeyComparison> {
  const fromSnapshot = checksumRows(
    (snapshot.rows.get(table) ?? []).map((row) => pickKeys(columns, row, keys))
  );

  const selected = keys.map((key) => `"${key.replace(/"/g, '""')}"::text`).join(", ");
  const rows = await client.query<Record<string, string | null>>(
    `select ${selected} from ${quoted(table)}`
  );
  const fromDatabase = checksumRows(rows.map((row) => keys.map((key) => row[key] ?? null)));

  return { checksum: fromDatabase, matches: fromSnapshot === fromDatabase };
}

/**
 * Compare a timestamp as an *instant*, not as text.
 *
 * The snapshot holds the wall-clock the legacy application wrote in Asia/Jakarta;
 * the database holds an absolute instant after the conversion. Comparing the two
 * as strings would report a seven-hour drift on every row, so each side is
 * reduced to epoch milliseconds first.
 */
async function compareInstant(
  snapshot: Snapshot,
  client: SqlClient,
  table: string,
  columns: string[]
): Promise<number> {
  const column = "created_at";
  const rows = snapshot.rows.get(table);
  if (!columns.includes(column) || !rows?.length) return 0;

  const index = columns.indexOf(column);
  const expected = rows
    .map((row) => row[index])
    .filter((value): value is string => value !== null)
    .map(jakartaInstant)
    .sort((a, b) => a - b);

  const stored = (
    await client.query<{ ms: string | null }>(
      `select (extract(epoch from ${quoted(table)}."${column}") * 1000)::bigint as ms
         from ${quoted(table)}
        order by 1`
    )
  )
    .map((row) => (row.ms === null ? Number.NaN : Number(row.ms)))
    .filter((ms) => !Number.isNaN(ms));

  if (expected.length !== stored.length) {
    return Math.abs(expected.length - stored.length);
  }
  return expected.reduce((count, ms, position) => count + (ms === stored[position] ? 0 : 1), 0);
}

/**
 * The instant a Jakarta wall-clock names. WIB is UTC+7 with no daylight saving,
 * so a fixed offset is exact — and matches what `AT TIME ZONE 'Asia/Jakarta'`
 * did to the column on the way in.
 */
function jakartaInstant(wallClock: string): number {
  return Date.parse(`${wallClock.replace(" ", "T")}+07:00`);
}

async function rowCount(client: SqlClient, table: string): Promise<number> {
  const rows = await client.query<{ value: number }>(
    `select count(*)::int as value from ${quoted(table)}`
  );
  return rows[0]?.value ?? 0;
}

type ForeignKey = {
  child: string;
  childColumns: string[];
  parent: string;
  parentColumns: string[];
};

/**
 * Count rows whose foreign key names a parent that is not there.
 *
 * The constraints themselves are enforced by Postgres on the way in, so this
 * finds nothing on a healthy load — it is the guard for a load that bypassed
 * enforcement, and for a later migration that moved children without their
 * parents.
 */
async function countOrphanedRows(client: SqlClient): Promise<{ total: number; example: string }> {
  const keys = await client.query<{
    child: string;
    child_column: string;
    parent: string;
    parent_column: string;
    constraint_name: string;
  }>(
    `select con.conname as constraint_name,
            cn.nspname || '.' || cc.relname as child,
            ca.attname as child_column,
            pn.nspname || '.' || pc.relname as parent,
            pa.attname as parent_column
       from pg_constraint con
       join pg_class cc on cc.oid = con.conrelid
       join pg_namespace cn on cn.oid = cc.relnamespace
       join pg_class pc on pc.oid = con.confrelid
       join pg_namespace pn on pn.oid = pc.relnamespace
       join lateral unnest(con.conkey) with ordinality as ck(attnum, ord) on true
       join lateral unnest(con.confkey) with ordinality as pk(attnum, ord) on pk.ord = ck.ord
       join pg_attribute ca on ca.attrelid = cc.oid and ca.attnum = ck.attnum
       join pg_attribute pa on pa.attrelid = pc.oid and pa.attnum = pk.attnum
      where con.contype = 'f'
      order by constraint_name, ck.ord`
  );

  const grouped = new Map<string, ForeignKey>();
  for (const key of keys) {
    const existing = grouped.get(key.constraint_name);
    if (existing) {
      existing.childColumns.push(key.child_column);
      existing.parentColumns.push(key.parent_column);
    } else {
      grouped.set(key.constraint_name, {
        child: key.child,
        childColumns: [key.child_column],
        parent: key.parent,
        parentColumns: [key.parent_column]
      });
    }
  }

  let total = 0;
  let example = "none";
  for (const key of grouped.values()) {
    const notNull = key.childColumns
      .map((column) => `c.${quote(column)} is not null`)
      .join(" and ");
    const matches = key.childColumns
      .map((column, index) => `p.${quote(key.parentColumns[index] as string)} = c.${quote(column)}`)
      .join(" and ");

    const rows = await client.query<{ value: number }>(
      `select count(*)::int as value
         from ${quoted(key.child)} c
        where ${notNull}
          and not exists (select 1 from ${quoted(key.parent)} p where ${matches})`
    );
    const count = rows[0]?.value ?? 0;
    if (count > 0) {
      total += count;
      if (example === "none") {
        example = `${key.child} → ${key.parent} (${count})`;
      }
    }
  }

  return { total, example };
}

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoted(table: string): string {
  return table.split(".").map(quote).join(".");
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
