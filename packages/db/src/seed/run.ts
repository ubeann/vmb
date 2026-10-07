import type { SqlClient } from "../sql-client.js";
import { WIPE_SCHEMAS, seedTables } from "./dataset.js";
import { insertStatement } from "./sql.js";

export type SeedReport = {
  tables: number;
  rows: number;
  milliseconds: number;
};

export type ApplicationTable = { schema: string; table: string };

/**
 * Every table in the schemas the seed owns, read from the catalog rather than
 * a hand-kept list, so a table a later migration adds cannot be forgotten and
 * left holding a production row. Exported for the tests, which snapshot the
 * same set.
 */
export async function applicationTables(client: SqlClient): Promise<ApplicationTable[]> {
  const schemas = WIPE_SCHEMAS.map((schema) => `'${schema}'`).join(", ");
  return client.query<ApplicationTable>(
    `select table_schema as schema, table_name as table
       from information_schema.tables
      where table_schema in (${schemas})
        and table_type = 'BASE TABLE'
      order by table_schema, table_name`
  );
}

/**
 * Replace every row in the five application schemas with the deterministic
 * preview fixtures (issue #120).
 *
 * The wipe and every insert are one transaction, so a failure anywhere rolls
 * the whole thing back: a preview is never left half-emptied, and a failed run
 * fails rather than serving a mixture of production rows and fixtures. The
 * journal in `drizzle` survives, so the next `db:migrate` still applies only
 * what is missing.
 *
 * The wipe discovers its tables from `information_schema` instead of a
 * hand-kept list, so a table a later migration adds cannot be forgotten and
 * left holding a production row. `TRUNCATE … RESTART IDENTITY CASCADE` is
 * preferred over `DELETE`: FK order stops mattering and sequences reset.
 */
export async function seed(client: SqlClient): Promise<SeedReport> {
  const started = performance.now();

  await client.exec("begin");
  try {
    // read inside the transaction, so the wipe list comes from the same
    // snapshot the truncate runs in rather than a moment before it
    await client.exec(await wipeStatement(client));
    for (const table of seedTables) {
      await client.exec(insertStatement(table));
    }
    await client.exec("commit");
  } catch (error) {
    await client.exec("rollback");
    throw error;
  }

  return {
    tables: seedTables.length,
    rows: seedTables.reduce((sum, table) => sum + table.rows.length, 0),
    milliseconds: Math.round(performance.now() - started)
  };
}

async function wipeStatement(client: SqlClient): Promise<string> {
  const found = await applicationTables(client);

  if (found.length === 0) {
    throw new Error("no tables to wipe. Is this database migrated?");
  }

  const names = found.map(({ schema, table }) => `"${schema}"."${table}"`).join(", ");
  return `truncate table ${names} restart identity cascade`;
}
