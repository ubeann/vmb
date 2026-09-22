import { describe, expect, it } from "vitest";
import { applyMigrations } from "../src/migration/apply.js";
import {
  PREVIEW_USER_EMAIL,
  PREVIEW_USER_ID,
  PREVIEW_USER_PASSWORD_HASH
} from "../src/seed/data/master.js";
import { applicationTables, seed } from "../src/seed/run.js";
import type { SqlClient } from "../src/sql-client.js";
import { count, migrationsFolder, scalar, withMigratedDatabase } from "./harness.js";

/**
 * Every table's contents as one canonical JSON text per table, ordered by the
 * row's own JSON so two reads of the same data compare equal regardless of
 * physical order.
 */
async function contents(client: SqlClient): Promise<Record<string, string>> {
  const tables = await applicationTables(client);

  const snapshot: Record<string, string> = {};
  for (const { schema, table } of tables) {
    snapshot[`${schema}.${table}`] = await scalar<string>(
      client,
      `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb)::text as value
         from "${schema}"."${table}" t`
    );
  }
  return snapshot;
}

/**
 * Every column that points at `master.users`, read from the catalog rather
 * than hand-kept, so a migration that adds another reference is covered by the
 * FK test below without an edit here.
 */
async function userReferences(
  client: SqlClient
): Promise<Array<{ schema: string; table: string; column: string }>> {
  return client.query(
    `select tc.table_schema as schema, tc.table_name as table, kcu.column_name as column
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_name = tc.constraint_name
        and kcu.constraint_schema = tc.constraint_schema
       join information_schema.constraint_column_usage ccu
         on ccu.constraint_name = tc.constraint_name
        and ccu.constraint_schema = tc.constraint_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and ccu.table_schema = 'master'
        and ccu.table_name = 'users'
      order by tc.table_schema, tc.table_name, kcu.column_name`
  );
}

describe("seed", () => {
  it("replaces every row, including tables the dataset does not write", async () => {
    await withMigratedDatabase(async (client) => {
      // `public.verification` is one of the two tables the dataset deliberately
      // leaves empty; a row here stands in for a production record.
      await client.exec(
        `insert into public.verification (id, identifier, value, expires_at, created_at, updated_at)
          values ('leftover', 'leftover@example.test', 'token', now(), now(), now())`
      );

      await seed(client);

      expect(await count(client, "select count(*)::int as value from public.verification")).toBe(0);
    });
  });

  it("produces identical contents on two consecutive runs", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);
      const first = await contents(client);

      await seed(client);

      expect(await contents(client)).toEqual(first);
    });
  });

  it("rolls the wipe back when a later insert fails", async () => {
    await withMigratedDatabase(async (client) => {
      await client.exec(
        `insert into master.divisions (id, name, code)
          values ('e0000000-0000-4000-8000-000000000001', 'Production Division', 'PROD')`
      );
      // The trigger fires on a table seeded near the end of the dataset, so the
      // wipe and most inserts have already run when the transaction aborts.
      await client.exec(
        `create function public.preview_seed_failure() returns trigger language plpgsql as $$
           begin
             raise exception 'seed failure drill';
           end
         $$;
         create trigger preview_seed_failure before insert on expense.request_niche_details
           for each row execute function public.preview_seed_failure()`
      );

      await expect(seed(client)).rejects.toThrow(/seed failure drill/);

      expect(
        await scalar<string>(client, "select name from master.divisions where code = 'PROD'")
      ).toBe("Production Division");
      expect(await count(client, "select count(*)::int as value from master.divisions")).toBe(1);
    });
  });

  it("keeps the migration journal so a later migrate applies nothing", async () => {
    await withMigratedDatabase(async (client) => {
      const before = await count(
        client,
        "select count(*)::int as value from drizzle.__drizzle_migrations"
      );

      await seed(client);

      expect(
        await count(client, "select count(*)::int as value from drizzle.__drizzle_migrations")
      ).toBe(before);

      const results = await applyMigrations(client, migrationsFolder);
      expect(results.every((migration) => !migration.applied)).toBe(true);
    });
  });

  it("seeds a verified credential user whose business row shares its id", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);

      const verified = await scalar<boolean>(
        client,
        `select email_verified from public."user" where email = '${PREVIEW_USER_EMAIL}'`
      );
      expect(verified).toBe(true);

      const password = await scalar<string>(
        client,
        `select password from public.account
          where provider_id = 'credential' and account_id = '${PREVIEW_USER_ID}'`
      );
      expect(password).toBe(PREVIEW_USER_PASSWORD_HASH);

      const businessEmail = await scalar<string>(
        client,
        `select email from master.users where id = '${PREVIEW_USER_ID}'`
      );
      expect(businessEmail).toBe(PREVIEW_USER_EMAIL);
    });
  });

  it("leaves no orphan behind any foreign key into master.users", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);

      const foreignKeys = await userReferences(client);
      expect(foreignKeys.length).toBeGreaterThan(0);

      for (const { schema, table, column } of foreignKeys) {
        const target = `${schema}.${table}.${column}`;
        const orphans = await count(
          client,
          `select count(*)::int as value
             from "${schema}"."${table}" t
            where t."${column}" is not null
              and not exists (select 1 from master.users u where u.id = t."${column}")`
        );
        expect(orphans, target).toBe(0);

        // the click-through path: the signed-in preview user appears in every
        // domain that references a user, so each one is walkable from the login
        const references = await count(
          client,
          `select count(*)::int as value from "${schema}"."${table}"
            where "${column}" = '${PREVIEW_USER_ID}'`
        );
        expect(references, `no row points at the preview user via ${target}`).toBeGreaterThan(0);
      }
    });
  });

  it("gives every list view enough rows to page", async () => {
    await withMigratedDatabase(async (client) => {
      await seed(client);

      const lists = [
        "master.divisions",
        "master.users",
        "trucking.clients",
        "trucking.drivers",
        "trucking.trucks",
        "trucking.locations",
        "trucking.routes",
        "trucking.orders",
        "trucking.invoices",
        "warehouse.items",
        "warehouse.procurement_requests",
        "warehouse.stock_requisitions",
        "warehouse.stock_alerts",
        "expense.requests"
      ];

      for (const list of lists) {
        const rows = await count(client, `select count(*)::int as value from ${list}`);
        expect(rows, list).toBeGreaterThan(10);
      }
    });
  });
});
