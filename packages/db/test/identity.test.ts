import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../src/sql-client.js";
import { transformIdentities } from "../src/import/identity.js";
import { importSnapshot } from "../src/import/run.js";
import { count, createDatabase, migrationsFolder, scalar, type TestDatabase } from "./harness.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const snapshotFile = path.join(testDir, "fixtures", "snapshot.sql");
const LEGACY_USER_ID = "22222222-2222-4222-8222-222222222222";

describe("the identity transform", () => {
  let database: TestDatabase;
  let client: SqlClient;

  beforeAll(async () => {
    database = await createDatabase();
    client = database.client;
    await importSnapshot(client, snapshotFile, migrationsFolder);
  });

  afterAll(async () => {
    await database?.close();
  });

  it("gives a replayed user an identity under the same UUID, verified, and no credential", async () => {
    expect(
      await scalar<string>(client, `select name from public."user" where id = '${LEGACY_USER_ID}'`)
    ).toBe("Fixture User");

    expect(
      await count(
        client,
        `select count(*)::int as value from public."user"
          where id = '${LEGACY_USER_ID}' and email_verified`
      )
    ).toBe(1);

    // the bcrypt hash in the snapshot never becomes a credential (ADR-0033)
    expect(await count(client, "select count(*)::int as value from public.account")).toBe(0);
  });

  it("preserves the email exactly as the snapshot carried it", async () => {
    expect(
      await scalar<string>(client, `select email from public."user" where id = '${LEGACY_USER_ID}'`)
    ).toBe("quote'and\\backslash@example.test");
  });

  it("creates one identity per replayed user", async () => {
    const users = await count(client, "select count(*)::int as value from master.users");
    const identities = await count(client, 'select count(*)::int as value from public."user"');

    expect(identities).toBe(users);
  });

  it("is idempotent: a second transform creates nothing", async () => {
    await expect(transformIdentities(client)).resolves.toEqual({ users: 0 });
  });
});
