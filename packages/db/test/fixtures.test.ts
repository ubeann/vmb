import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "./fixtures/index.js";
import { loadFixture, migratedDatabase, scalar } from "./harness.js";

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
    await loadFixture(client, "edge-cases.sql");
  });

  it("keeps a user with no division", async () => {
    const divisionless = await scalar<number>(
      client,
      "select count(*)::int from master.users where division_id is null"
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
    const orphans = await scalar<number>(
      client,
      `select count(*)::int from trucking.approvals a
        where a.approvable_type = 'App\\Models\\Trucking\\Order'
          and not exists (select 1 from trucking.orders o where o.id = a.approvable_id)`
    );
    expect(orphans).toBe(1);
  });

  it("keeps a cancelled order without a cancelled_by user", async () => {
    const cancelled = await scalar<number>(
      client,
      `select count(*)::int from trucking.orders
        where cancel_reason is not null and cancelled_by is null`
    );
    expect(cancelled).toBe(1);
  });

  it("keeps a soft-deleted order", async () => {
    const deleted = await scalar<number>(
      client,
      "select count(*)::int from trucking.orders where deleted_at is not null"
    );
    expect(deleted).toBe(1);
  });

  it("keeps a cross-schema reference from a warehouse item to a master division", async () => {
    const items = await scalar<number>(
      client,
      `select count(*)::int from warehouse.items i
        join master.divisions d on d.id = i.division_id
        where i.code = 'IT-EDGE'`
    );
    expect(items).toBe(1);
  });
});
