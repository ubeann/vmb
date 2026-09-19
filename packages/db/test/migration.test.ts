import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { count, migratedDatabase } from "./harness.js";

const LEGACY_SCHEMAS = "'master','warehouse','trucking','expense'";

describe("the migration chain", () => {
  // One migrated database per file: replaying the chain is the expensive part,
  // and every assertion below is read-only.
  let client: PGlite;

  beforeAll(async () => {
    client = await migratedDatabase();
  });

  it("applies cleanly to an empty database", async () => {
    const tables = await count(
      client,
      `select count(*)::int as value from information_schema.tables
        where table_schema in (${LEGACY_SCHEMAS})`
    );
    expect(tables).toBe(30);
  });

  it("keeps the four legacy schemas and no others", async () => {
    const schemas = await client.query<{ nspname: string }>(
      `select nspname from pg_namespace
        where nspname not like 'pg\\_%'
          and nspname not in ('information_schema', 'drizzle')
        order by nspname`
    );
    expect(schemas.rows.map((r) => r.nspname)).toEqual([
      "expense",
      "master",
      "public",
      "trucking",
      "warehouse"
    ]);
  });

  it("records a journal entry for every migration applied so far", async () => {
    const applied = await count(
      client,
      "select count(*)::int as value from drizzle.__drizzle_migrations"
    );
    expect(applied).toBeGreaterThanOrEqual(2);
  });

  it("leaves no dangling foreign keys", async () => {
    const dangling = await count(
      client,
      `select count(*)::int as value from pg_constraint c
        where c.contype = 'f'
          and not exists (select 1 from pg_class t where t.oid = c.confrelid)`
    );
    expect(dangling).toBe(0);
  });

  it("retains the legacy quirks the port is faithful to", async () => {
    // master.users stays as a staging table and keeps its inbound foreign keys
    const usersFks = await count(
      client,
      `select count(*)::int as value from pg_constraint
        where contype = 'f' and confrelid = 'master.users'::regclass`
    );
    expect(usersFks).toBe(10);

    // the morph approval target has no foreign key to enforce it
    const morphFks = await count(
      client,
      `select count(*)::int as value from pg_constraint
        where contype = 'f' and conrelid = 'trucking.approvals'::regclass
          and pg_get_constraintdef(oid) like '%approvable_id%'`
    );
    expect(morphFks).toBe(0);

    // the status vocabulary is a check constraint, not an enum
    const statusChecks = await count(
      client,
      `select count(*)::int as value from pg_constraint
        where contype = 'c' and conrelid = 'master.users'::regclass
          and pg_get_constraintdef(oid) like '%status%'`
    );
    expect(statusChecks).toBe(1);

    // a redundant index sits beside the unique constraint on the same column
    const licensePlateIndexes = await count(
      client,
      `select count(*)::int as value from pg_indexes
        where schemaname = 'trucking'
          and tablename = 'trucks'
          and indexdef like '%(license_plate)%'`
    );
    expect(licensePlateIndexes).toBe(2);
  });

  it("mints identity in the database for new rows", async () => {
    // every ported uuid primary key except the client-route link's carries a
    // default — asserted on the primary-key column, not just a column named id
    const withDefault = await count(
      client,
      `select count(*)::int as value
         from pg_constraint p
         join pg_class t on t.oid = p.conrelid
         join pg_namespace n on n.oid = t.relnamespace
         join information_schema.columns c
           on c.table_schema = n.nspname
          and c.table_name = t.relname
          and c.column_name = 'id'
        where p.contype = 'p'
          and n.nspname in (${LEGACY_SCHEMAS})
          and pg_get_constraintdef(p.oid) like '%PRIMARY KEY (id)%'
          and c.column_default like 'gen_random_uuid%'`
    );
    expect(withDefault).toBe(29);

    // the client-route link keeps its natural key and no surrogate
    const surrogate = await count(
      client,
      `select count(*)::int as value from information_schema.columns
        where table_schema = 'trucking'
          and table_name = 'client_route'
          and column_name = 'id'`
    );
    expect(surrogate).toBe(0);

    const naturalKey = await count(
      client,
      `select count(*)::int as value from pg_constraint
        where conrelid = 'trucking.client_route'::regclass
          and contype = 'p'
          and pg_get_constraintdef(oid) like '%(client_id, route_id)%'`
    );
    expect(naturalKey).toBe(1);

    // and its sequence went with the surrogate
    const sequence = await count(
      client,
      `select count(*)::int as value
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'S'
          and n.nspname = 'trucking'
          and c.relname = 'client_route_id_seq'`
    );
    expect(sequence).toBe(0);
  });
});
