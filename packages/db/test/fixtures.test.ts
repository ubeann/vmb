import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "./fixtures/index.js";
import { count, loadFixture, migratedDatabase, scalar } from "./harness.js";

const edgeCases = fixtures.find((fixture) => fixture.name === "edge-cases");
if (!edgeCases) {
  throw new Error("the edge-cases fixture is not registered");
}

describe.each(fixtures)("fixture: $name", ({ file, purpose }) => {
  it(`loads over the migrated baseline — ${purpose}`, async () => {
    const client = await migratedDatabase();

    await expect(loadFixture(client, file)).resolves.toBeUndefined();
  });
});

describe("the edge-cases fixture", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = await migratedDatabase();
    await loadFixture(client, edgeCases.file);
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
