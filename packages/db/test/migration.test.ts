import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { migratedDatabase, scalar } from "./harness.js";

const LEGACY_SCHEMAS = "'master','warehouse','trucking','expense'";

describe("the migration chain", () => {
  // One migrated database per file: replaying the chain is the expensive part,
  // and every assertion below is read-only.
  let client: PGlite;

  beforeAll(async () => {
    client = await migratedDatabase();
  });

  it("applies cleanly to an empty database", async () => {
    const tables = await scalar<number>(
      client,
      `select count(*)::int from information_schema.tables
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

  it("records both migrations in the journal", async () => {
    const applied = await scalar<number>(
      client,
      "select count(*)::int from drizzle.__drizzle_migrations"
    );
    expect(applied).toBe(2);
  });

  it("leaves no dangling foreign keys", async () => {
    const dangling = await scalar<number>(
      client,
      `select count(*)::int from pg_constraint c
        where c.contype = 'f'
          and not exists (select 1 from pg_class t where t.oid = c.confrelid)`
    );
    expect(dangling).toBe(0);
  });

  it("retains the legacy quirks the port is faithful to", async () => {
    // master.users stays as a staging table and keeps its inbound foreign keys
    const usersFks = await scalar<number>(
      client,
      `select count(*)::int from pg_constraint
        where contype = 'f' and confrelid = 'master.users'::regclass`
    );
    expect(usersFks).toBe(10);

    // the morph approval target has no foreign key to enforce it
    const morphFks = await scalar<number>(
      client,
      `select count(*)::int from pg_constraint
        where contype = 'f' and conrelid = 'trucking.approvals'::regclass
          and pg_get_constraintdef(oid) like '%approvable_id%'`
    );
    expect(morphFks).toBe(0);

    // the status vocabulary is a check constraint, not an enum
    const statusChecks = await scalar<number>(
      client,
      `select count(*)::int from pg_constraint
        where contype = 'c' and conrelid = 'master.users'::regclass
          and pg_get_constraintdef(oid) like '%status%'`
    );
    expect(statusChecks).toBe(1);
  });
});
