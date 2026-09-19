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

describe("the trucking hygiene migrations", () => {
  // #107: one migration per deviation, each named by its ledger row.
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

  it("restricts the orders client key, which is what it already did", async () => {
    const [key] = await client.query<{ confdeltype: string }>(
      `select confdeltype from pg_constraint
        where conname = 'trucking_orders_client_id_foreign'`
    );
    // 'r' is RESTRICT: the declaration now says what the not-null column did
    expect(key?.confdeltype).toBe("r");

    await client.exec(
      `insert into trucking.clients (id, name, code)
       values ('f1111111-1111-4111-8111-111111111111', 'Hygiene Client', 'HC-1')`
    );
    await client.exec(
      `insert into trucking.orders (id, client_id, code, type, party_count, status)
       values ('f2222222-2222-4222-8222-222222222222',
               'f1111111-1111-4111-8111-111111111111', 9001, 'export', 1, 'draft')`
    );

    // the delete that used to fail on a not-null violation is still refused,
    // now by the key itself
    await expect(
      client.exec(`delete from trucking.clients where id = 'f1111111-1111-4111-8111-111111111111'`)
    ).rejects.toThrow(/foreign key constraint/);
  });

  it("makes the four pairs unique", async () => {
    const uniques = await client.query<{ conname: string }>(
      `select conname from pg_constraint
        where contype = 'u' and conname in (
          'trucking_daily_trucking_actuals_trip_id_plan_code_unique',
          'trucking_daily_trucking_plans_trip_id_plan_code_unique',
          'trucking_locations_code_unique',
          'trucking_route_locations_route_id_position_unique'
        )
        order by conname`
    );
    expect(uniques.map((row) => row.conname)).toEqual([
      "trucking_daily_trucking_actuals_trip_id_plan_code_unique",
      "trucking_daily_trucking_plans_trip_id_plan_code_unique",
      "trucking_locations_code_unique",
      "trucking_route_locations_route_id_position_unique"
    ]);

    // invoice_shipments is deliberately not among them: the legacy database
    // permits many shipments per invoice, so 1:1 was never established
    const shipments = await count(
      client,
      `select count(*)::int as value from pg_constraint
        where conname = 'trucking_invoice_shipments_invoice_id_unique'`
    );
    expect(shipments).toBe(0);

    // and the uniqueness bites: a second location with the same code is refused
    await client.exec(
      `insert into trucking.locations (id, code)
       values ('f3333333-3333-4333-8333-333333333333', 'LOC-1')`
    );
    await expect(
      client.exec(
        `insert into trucking.locations (id, code)
         values ('f4444444-4444-4444-8444-444444444444', 'LOC-1')`
      )
    ).rejects.toThrow(/trucking_locations_code_unique/);
  });

  it("drops every index a unique constraint or a primary key already covers", async () => {
    const redundant = await count(
      client,
      // `approvable_index` is also the name on trucking's and expense's
      // approvals, where it is not redundant; only the warehouse one is
      `select count(*)::int as value from pg_indexes
        where indexname in (
          'trucking_client_route_client_id_index',
          'trucking_clients_code_index',
          'trucking_locations_code_index',
          'trucking_orders_code_index',
          'trucking_route_locations_route_id_index',
          'trucking_trucks_license_plate_index'
        )
        or (schemaname = 'warehouse' and indexname = 'approvable_index')`
    );
    expect(redundant).toBe(0);

    // the uniqueness each of them stood for is still there
    const stillUnique = await count(
      client,
      `select count(*)::int as value from pg_constraint
        where contype in ('p', 'u') and conname in (
          'trucking_clients_code_unique',
          'trucking_orders_code_unique',
          'trucking_trucks_license_plate_unique',
          'trucking_locations_code_unique',
          'trucking_route_locations_route_id_position_unique',
          'client_route_pkey',
          'warehouse_approvals_approvable_type_approvable_id_type_unique'
        )`
    );
    expect(stillUnique).toBe(7);
  });

  it("aligns the plan and actual fee with the route fee", async () => {
    const fees = await client.query<{
      table_name: string;
      data_type: string;
      numeric_precision: number;
      numeric_scale: number;
    }>(
      `select table_name, data_type, numeric_precision, numeric_scale
         from information_schema.columns
        where table_schema = 'trucking' and column_name = 'fee'
        order by table_name`
    );

    // an integer fee lost the cents a route fee carries
    expect(fees).toEqual([
      {
        table_name: "daily_trucking_actuals",
        data_type: "numeric",
        numeric_precision: 15,
        numeric_scale: 2
      },
      {
        table_name: "daily_trucking_plans",
        data_type: "numeric",
        numeric_precision: 15,
        numeric_scale: 2
      },
      {
        table_name: "routes",
        data_type: "numeric",
        numeric_precision: 15,
        numeric_scale: 2
      }
    ]);
  });

  it("defaults an invoice to the first status in its workflow", async () => {
    await client.exec(
      `insert into trucking.clients (id, name, code)
       values ('f5555555-5555-4555-8555-555555555555', 'Invoice Client', 'IC-1')`
    );

    const status = await scalar<string>(
      client,
      `insert into trucking.invoices (client_id)
       values ('f5555555-5555-4555-8555-555555555555')
       returning status`
    );
    // 'draft' was not a value of the vocabulary; the create path uses this one
    expect(status).toBe("receive_document");
  });
});

describe("the expense hygiene migrations", () => {
  // #108: one migration per deviation, each named by its ledger row.
  let database: TestDatabase;
  let client: SqlClient;

  beforeAll(async () => {
    database = await createDatabase();
    await database.migrate();
    client = database.client;
    await client.exec(
      `insert into master.divisions (id, name, code)
       values ('e1111111-1111-4111-8111-111111111111', 'Expense Hygiene', 'EXH')`
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it("makes a budget one per division and a detail one per request", async () => {
    const uniques = await client.query<{ conname: string }>(
      `select conname from pg_constraint
        where contype = 'u' and conname in (
          'expense_budgets_division_id_unique',
          'expense_request_emergency_details_request_id_unique',
          'expense_request_niche_details_request_id_unique'
        )
        order by conname`
    );
    expect(uniques.map((row) => row.conname)).toEqual([
      "expense_budgets_division_id_unique",
      "expense_request_emergency_details_request_id_unique",
      "expense_request_niche_details_request_id_unique"
    ]);

    // one budget per division, because a second is refused
    await client.exec(
      `insert into expense.budgets (division_id)
       values ('e1111111-1111-4111-8111-111111111111')`
    );
    await expect(
      client.exec(
        `insert into expense.budgets (division_id)
         values ('e1111111-1111-4111-8111-111111111111')`
      )
    ).rejects.toThrow(/expense_budgets_division_id_unique/);
  });

  it("refuses a second detail for the same request", async () => {
    await client.exec(
      `insert into expense.requests (id, division_id, type)
       values ('e2222222-2222-4222-8222-222222222222',
               'e1111111-1111-4111-8111-111111111111', 'NICHE')`
    );
    await client.exec(
      `insert into expense.request_niche_details (request_id, amount)
       values ('e2222222-2222-4222-8222-222222222222', 1)`
    );
    await expect(
      client.exec(
        `insert into expense.request_niche_details (request_id, amount)
         values ('e2222222-2222-4222-8222-222222222222', 2)`
      )
    ).rejects.toThrow(/expense_request_niche_details_request_id_unique/);
  });

  it("indexes the foreign keys nothing was behind", async () => {
    const indexes = await count(
      client,
      `select count(*)::int as value from pg_indexes
        where schemaname = 'expense' and indexname in (
          'expense_approvals_approver_id_index',
          'expense_requests_division_id_status_created_at_index',
          'expense_requests_user_id_index'
        )`
    );
    expect(indexes).toBe(3);
  });

  it("makes an approval one per target and level, without shadowing it", async () => {
    const uniques = await count(
      client,
      `select count(*)::int as value from pg_constraint
        where conname = 'expense_approvals_approvable_type_approvable_id_type_unique'`
    );
    expect(uniques).toBe(1);

    // the plain index on the first two columns was a prefix of the unique, so
    // it went in the same change rather than becoming a redundancy
    const shadowed = await count(
      client,
      `select count(*)::int as value from pg_indexes
        where schemaname = 'expense' and indexname = 'approvable_index'`
    );
    expect(shadowed).toBe(0);

    const approval = `insert into expense.approvals (approvable_type, approvable_id, type)
      values ('App\\Models\\Expense\\Request', 'e4444444-4444-4444-8444-444444444444', 'FINANCE')`;
    await client.exec(approval);
    await expect(client.exec(approval)).rejects.toThrow(/approvable_type_approvable_id_type/);
    // a different level is a different approval, not a duplicate
    await client.exec(approval.replace("'FINANCE'", "'DIVISION'"));
  });

  it("refuses a budget with a negative amount", async () => {
    await client.exec(
      `insert into master.divisions (id, name, code)
       values ('e5555555-5555-4555-8555-555555555555', 'Negative Amount', 'NEG')`
    );
    await expect(
      client.exec(
        `insert into expense.budgets (division_id, amount)
         values ('e5555555-5555-4555-8555-555555555555', -1)`
      )
    ).rejects.toThrow(/expense_budgets_amount_check/);
  });

  it("defaults a request to the status its vocabulary names", async () => {
    const status = await scalar<string>(
      client,
      `insert into expense.requests (division_id, type)
       values ('e1111111-1111-4111-8111-111111111111', 'NICHE')
       returning status`
    );
    // the schema defaulted to lowercase 'pending', which is no case of the
    // vocabulary and cannot hydrate it
    expect(status).toBe("PENDING");
  });

  it("constrains both request vocabularies and the emergency category", async () => {
    const vocabularies: Record<string, string[]> = {
      expense_requests_status_check: [
        "PENDING",
        "WAITING_FOR_SUPPORTING_DOCUMENTS",
        "SUBMITTING_SUPPORTING_DOCUMENTS",
        "COMPLETED",
        "REJECTED"
      ],
      expense_requests_type_check: ["NICHE", "EMERGENCY"],
      expense_request_emergency_details_category_check: ["1", "2", "3", "4", "5"]
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

    // each vocabulary bites
    await expect(
      client.exec(
        `insert into expense.requests (division_id, type, status)
         values ('e1111111-1111-4111-8111-111111111111', 'NICHE', 'pending')`
      )
    ).rejects.toThrow(/expense_requests_status_check/);

    await expect(
      client.exec(
        `insert into expense.requests (division_id, type)
         values ('e1111111-1111-4111-8111-111111111111', 'SOMETHING_ELSE')`
      )
    ).rejects.toThrow(/expense_requests_type_check/);

    await client.exec(
      `insert into expense.requests (id, division_id, type)
       values ('e3333333-3333-4333-8333-333333333333',
               'e1111111-1111-4111-8111-111111111111', 'EMERGENCY')`
    );
    await expect(
      client.exec(
        `insert into expense.request_emergency_details (request_id, category, budget_usage)
         values ('e3333333-3333-4333-8333-333333333333', '9', 'x')`
      )
    ).rejects.toThrow(/category_check/);
  });
});
