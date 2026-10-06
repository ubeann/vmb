import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../src/sql-client.js";
import { fixtures } from "./fixtures/index.js";
import {
  count,
  createDatabase,
  loadFixture,
  scalar,
  withMigratedDatabase,
  type TestDatabase
} from "./harness.js";

const edgeCases = fixtures.find((fixture) => fixture.name === "edge-cases");
if (!edgeCases) {
  throw new Error("the edge-cases fixture is not registered");
}

describe.each(fixtures)("fixture: $name", ({ file, purpose }) => {
  it(`loads over the migrated baseline — ${purpose}`, async () => {
    await withMigratedDatabase(async (client) => {
      await expect(loadFixture(client, file)).resolves.toBeUndefined();
    });
  });
});

describe("database-minted identity", () => {
  it("assigns a uuid when the insert omits one, and keeps an explicit value", async () => {
    await withMigratedDatabase(async (client) => {
      const minted = await scalar<string>(
        client,
        "insert into master.divisions (name, code) values ('Minted Division', 'MINT') returning id"
      );
      expect(minted).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );

      const explicit = await scalar<string>(
        client,
        `insert into master.divisions (id, name, code)
          values ('b1111111-1111-4111-8111-111111111111', 'Explicit Division', 'EXPL')
          returning id`
      );
      expect(explicit).toBe("b1111111-1111-4111-8111-111111111111");
    });
  });
});

describe("the edge-cases fixture", () => {
  let database: TestDatabase;
  let client: SqlClient;

  beforeAll(async () => {
    database = await createDatabase();
    await database.migrate();
    client = database.client;
    await loadFixture(client, edgeCases.file);
  });

  afterAll(async () => {
    await database?.close();
  });

  it("keeps a user who holds no role", async () => {
    const roleless = await count(
      client,
      `select count(*)::int as value from master.users u
        where not exists (select 1 from master.user_roles ur where ur.user_id = u.id)`
    );
    expect(roleless).toBe(2);
  });

  it("takes the corrected status default when none is given", async () => {
    // the schema used to default this to 'pending', which is not a value of the
    // workflow's vocabulary; #106 corrected the default rather than the row
    const status = await scalar<string>(
      client,
      "select status from warehouse.procurement_requests where request_number = 'PR-EDGE-001'"
    );
    expect(status).toBe("pending_approval");
  });

  it("keeps an approval whose target does not exist", async () => {
    const orphans = await count(
      client,
      `select count(*)::int as value from trucking.approvals a
        where a.approvable_type = 'App\\Models\\Trucking\\Order'
          and not exists (select 1 from trucking.orders o where o.id = a.approvable_id)`
    );
    expect(orphans).toBe(1);
  });

  it("keeps a cancelled order without a cancelled_by user", async () => {
    const cancelled = await count(
      client,
      `select count(*)::int as value from trucking.orders
        where cancel_reason is not null and cancelled_by is null`
    );
    expect(cancelled).toBe(1);
  });

  it("keeps a soft-deleted order", async () => {
    const deleted = await count(
      client,
      "select count(*)::int as value from trucking.orders where deleted_at is not null"
    );
    expect(deleted).toBe(1);
  });

  it("keeps a cross-schema reference from a warehouse item to a master division", async () => {
    const items = await count(
      client,
      `select count(*)::int as value from warehouse.items i
        join master.divisions d on d.id = i.division_id
        where i.code = 'IT-EDGE'`
    );
    expect(items).toBe(1);
  });
});
