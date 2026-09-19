import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../src/import/client.js";
import { count, createDatabase, scalar, type TestDatabase } from "./harness.js";

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

  it("constrains each status and approval type to its whole vocabulary", async () => {
    // the values come from the legacy PHP enums; a truncated CHECK would pass a
    // test that only asserted the constraint exists
    const vocabularies: Record<string, string[]> = {
      warehouse_procurement_requests_status_check: [
        "pending_approval",
        "division_approved",
        "finance_approved",
        "quotation_submitted",
        "budget_transferred",
        "fulfillment_evidence_received",
        "director_approved",
        "rejected",
        "completed"
      ],
      warehouse_stock_requisitions_status_check: [
        "pending_approval",
        "division_approved",
        "rejected",
        "completed"
      ],
      warehouse_approvals_type_check: ["division", "finance", "director"]
    };

    for (const [name, values] of Object.entries(vocabularies)) {
      const definition = await scalar<string>(
        client,
        `select pg_get_constraintdef(oid) from pg_constraint where conname = '${name}'`
      );
      for (const value of values) {
        expect(definition).toContain(`'${value}'`);
      }
    }

    // and the vocabulary bites: a status the workflow never had is rejected
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
    const approval = `insert into warehouse.approvals (approvable_type, approvable_id, type)
      values ('App\\Models\\Warehouse\\ProcurementRequest', 'd1111111-1111-4111-8111-111111111111', 'division')`;

    await client.exec(approval);
    await expect(client.exec(approval)).rejects.toThrow(/approvable_type_approvable_id_type/);
    // a different level is a different approval
    await client.exec(approval.replace("'division'", "'finance'"));

    // a request and its quotation, with the rows they depend on
    await client.exec(
      `insert into master.divisions (id, name, code)
       values ('d2222222-2222-4222-8222-222222222222', 'Hygiene', 'HYG')`
    );
    await client.exec(
      `insert into master.users (id, name, email, password, division_id)
       values ('d3333333-3333-4333-8333-333333333333', 'Hygiene User',
               'hygiene@example.test', 'x', 'd2222222-2222-4222-8222-222222222222')`
    );
    await client.exec(
      `insert into warehouse.items (id, division_id, name)
       values ('d4444444-4444-4444-8444-444444444444',
               'd2222222-2222-4222-8222-222222222222', 'Hygiene Item')`
    );
    await client.exec(
      `insert into warehouse.procurement_quotations
         (id, quoted_price, vendor_name, vendor_website, payment_account)
       values ('d5555555-5555-4555-8555-555555555555', 1, 'Vendor',
               'https://vendor.test', 'ACC')`
    );

    const request = (
      number: string,
      quotation: string
    ) => `insert into warehouse.procurement_requests
      (request_number, requester_id, item_id, unit_price, requested_quantity,
       total_amount, justification, quotation_id)
      values ('${number}', 'd3333333-3333-4333-8333-333333333333',
              'd4444444-4444-4444-8444-444444444444', 1, 1, 1, 'x', ${quotation})`;

    await client.exec(request("PR-ONE", "'d5555555-5555-4555-8555-555555555555'"));
    await expect(
      client.exec(request("PR-TWO", "'d5555555-5555-4555-8555-555555555555'"))
    ).rejects.toThrow(/quotation_id/);

    // a request with no quotation is not the same quotation, and two of those
    // are fine: null never collides in a unique constraint
    await client.exec(request("PR-THREE", "null"));
    await client.exec(request("PR-FOUR", "null"));
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
