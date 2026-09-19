import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../src/import/client.js";
import { count, createDatabase, type TestDatabase } from "./harness.js";

const LEGACY_SCHEMAS = "'master','warehouse','trucking','expense'";

describe("the migration chain", () => {
  // One migrated database per file: replaying the chain is the expensive part,
  // and every assertion below is read-only.
  let database: TestDatabase;
  let client: SqlClient;

  beforeAll(async () => {
    database = await createDatabase();
    await database.migrate();
    client = database.client;
  });

  afterAll(async () => {
    await database?.close();
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
    expect(schemas.map((r) => r.nspname)).toEqual([
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

describe("the master and warehouse hygiene migrations", () => {
  // #106: each deviation below is one migration, and the ledger names it.
  let database: TestDatabase;
  let client: SqlClient;

  beforeAll(async () => {
    database = await createDatabase();
    await database.migrate();
    client = database.client;
  });

  afterAll(async () => {
    await database.close();
  });

  it("widens divisions.description to text and requires code", async () => {
    const column = await client.query<{ data_type: string; is_nullable: string }>(
      `select data_type, is_nullable from information_schema.columns
        where table_schema = 'master' and table_name = 'divisions'
          and column_name in ('description', 'code')
        order by column_name`
    );
    expect(column).toEqual([
      { data_type: "character varying", is_nullable: "NO" },
      { data_type: "text", is_nullable: "YES" }
    ]);
  });

  it("indexes the division on a user", async () => {
    const indexes = await count(
      client,
      `select count(*)::int as value from pg_indexes
        where schemaname = 'master' and indexname = 'master_users_division_id_index'`
    );
    expect(indexes).toBe(1);
  });

  it("defaults both warehouse workflows to a status their vocabulary has", async () => {
    const defaults = await client.query<{ column_default: string | null }>(
      `select column_default from information_schema.columns
        where table_schema = 'warehouse'
          and table_name in ('procurement_requests', 'stock_requisitions')
          and column_name = 'status'
        order by table_name`
    );
    expect(defaults.map((row) => row.column_default)).toEqual([
      "'pending_approval'::character varying",
      "'pending_approval'::character varying"
    ]);
  });

  it("constrains each status and approval type to its vocabulary", async () => {
    const checks = await client.query<{ conname: string }>(
      `select conname from pg_constraint
        where contype = 'c'
          and conname in (
            'warehouse_procurement_requests_status_check',
            'warehouse_stock_requisitions_status_check',
            'warehouse_approvals_type_check'
          )
        order by conname`
    );
    expect(checks.map((row) => row.conname)).toEqual([
      "warehouse_approvals_type_check",
      "warehouse_procurement_requests_status_check",
      "warehouse_stock_requisitions_status_check"
    ]);

    // the vocabulary bites: a status the workflow never had is rejected
    await expect(
      client.exec(
        `insert into warehouse.procurement_requests
           (request_number, requester_id, item_id, status, unit_price,
            requested_quantity, total_amount, justification)
         values ('PR-CHECK', 'b1111111-1111-4111-8111-111111111111',
                 'b1111111-1111-4111-8111-111111111111', 'pending', 1, 1, 1, 'x')`
      )
    ).rejects.toThrow(/status_check/);
  });

  it("requires a division code", async () => {
    await expect(
      client.exec("insert into master.divisions (name) values ('No Code')")
    ).rejects.toThrow(/code/);
  });

  it("makes an approval unique per target and level, and a quotation per request", async () => {
    const uniques = await client.query<{ conname: string }>(
      `select conname from pg_constraint
        where contype = 'u'
          and conname in (
            'warehouse_approvals_approvable_type_approvable_id_type_unique',
            'warehouse_procurement_requests_quotation_id_unique'
          )
        order by conname`
    );
    expect(uniques.map((row) => row.conname)).toEqual([
      "warehouse_approvals_approvable_type_approvable_id_type_unique",
      "warehouse_procurement_requests_quotation_id_unique"
    ]);
  });

  it("indexes both workflow tables by status and age", async () => {
    const indexes = await count(
      client,
      `select count(*)::int as value from pg_indexes
        where schemaname = 'warehouse'
          and indexname in (
            'warehouse_procurement_requests_status_created_at_index',
            'warehouse_stock_requisitions_status_created_at_index'
          )`
    );
    expect(indexes).toBe(2);
  });
});
