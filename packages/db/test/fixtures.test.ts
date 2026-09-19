import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../src/import/client.js";
import { fixtures } from "./fixtures/index.js";
import { count, createDatabase, loadFixture, scalar, type TestDatabase } from "./harness.js";

const edgeCases = fixtures.find((fixture) => fixture.name === "edge-cases");
if (!edgeCases) {
  throw new Error("the edge-cases fixture is not registered");
}

describe.each(fixtures)("fixture: $name", ({ file, purpose }) => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createDatabase();
    await database.migrate();
  });

  afterAll(async () => {
    await database?.close();
  });

  it(`loads over the migrated baseline — ${purpose}`, async () => {
    await expect(loadFixture(database.client, file)).resolves.toBeUndefined();
  });
});

describe("database-minted identity", () => {
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

  it("assigns a uuid when the insert omits one, and keeps an explicit value", async () => {
    const minted = await scalar<string>(
      client,
      "insert into master.divisions (name) values ('Minted Division') returning id"
    );
    expect(minted).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const explicit = await scalar<string>(
      client,
      `insert into master.divisions (id, name)
        values ('b1111111-1111-4111-8111-111111111111', 'Explicit Division')
        returning id`
    );
    expect(explicit).toBe("b1111111-1111-4111-8111-111111111111");
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

  it("keeps a user with no division", async () => {
    const divisionless = await count(
      client,
      "select count(*)::int as value from master.users where division_id is null"
    );
    expect(divisionless).toBe(1);
  });

  it("keeps the schema default status the enum cannot hydrate", async () => {
    const status = await scalar<string>(
      client,
      "select status from warehouse.procurement_requests where request_number = 'PR-EDGE-001'"
    );
    expect(status).toBe("pending");
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
