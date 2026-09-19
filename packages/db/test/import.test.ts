import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SqlClient } from "../src/import/client.js";
import { loadStatements } from "../src/import/load.js";
import { excludedTables, portedTables } from "../src/import/manifest.js";
import { byPhase, readChain } from "../src/import/phases.js";
import { importSnapshot, summarise } from "../src/import/run.js";
import { schemaOrder } from "../src/import/schema-order.js";
import { parseSnapshot, readSnapshot } from "../src/import/snapshot.js";
import { verify } from "../src/import/verify.js";
import {
  count,
  createDatabase,
  migrationsFolder,
  scalar,
  withDatabase,
  type TestDatabase
} from "./harness.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const snapshotFile = path.join(testDir, "fixtures", "snapshot.sql");

describe("the snapshot parser", () => {
  it("reads a COPY block's columns and rows", async () => {
    const snapshot = await readSnapshot(snapshotFile);

    expect(snapshot.columns.get("master.divisions")).toEqual([
      "id",
      "name",
      "code",
      "description",
      "color_hex",
      "icon_name",
      "is_active",
      "created_at",
      "updated_at",
      "deleted_at"
    ]);
    expect(snapshot.rows.get("master.divisions")).toHaveLength(1);
  });

  it("undoes COPY escaping, keeping null and a literal marker distinct", () => {
    const snapshot = parseSnapshot(
      [
        "COPY t.a (x, y, z, w) FROM stdin;",
        "quote'and\\\\backslash\ttab\\there\t\\N\t\\\\N",
        "\\."
      ].join("\n")
    );

    // `\N` is null; `\\N` is the two characters backslash-N
    expect(snapshot.rows.get("t.a")).toEqual([["quote'and\\backslash", "tab\there", null, "\\N"]]);
  });
});

describe("the loader", () => {
  it("emits one insert per row, nulls unquoted", () => {
    const { statements, problems } = loadStatements(
      parseSnapshot(
        ["COPY master.divisions (id, code, description) FROM stdin;", "d1\tOPS\t\\N", "\\."].join(
          "\n"
        )
      )
    );

    expect(statements).toEqual([
      `INSERT INTO master.divisions ("id", "code", "description") VALUES ('d1', 'OPS', NULL);`
    ]);
    expect(problems).toEqual([]);
  });

  it("covers the ported tables and leaves the excluded ones alone", async () => {
    const snapshot = await readSnapshot(snapshotFile);
    const { statements } = loadStatements(snapshot);

    for (const { table } of excludedTables) {
      expect(statements.some((s) => s.includes(`INTO ${table} `))).toBe(false);
    }
    for (const table of ["master.roles", "spatie.role_has_permissions"]) {
      expect(snapshot.rows.has(table)).toBe(true);
    }
    expect(portedTables).toHaveLength(30);
  });
});

describe("the migration chain in two phases", () => {
  it("splits at the baseline", async () => {
    const chain = await readChain(migrationsFolder);

    expect(byPhase(chain, "baseline").map((m) => m.tag)).toEqual([
      "0000_better_auth_schema",
      "0001_legacy_baseline"
    ]);
    expect(byPhase(chain, "after").map((m) => m.tag)).toEqual(["0002_legacy_identity_corrections"]);
  });
});

describe("the import pipeline", () => {
  // One database for this block: the re-run test needs the state the first run
  // left behind, which is exactly what it is about.
  let database: TestDatabase;
  let client: SqlClient;
  let report: Awaited<ReturnType<typeof importSnapshot>>;

  beforeAll(async () => {
    database = await createDatabase();
    client = database.client;
    report = await importSnapshot(client, snapshotFile, migrationsFolder);
  });

  afterAll(async () => {
    await database?.close();
  });

  it("reports zero errors and zero warnings on good data", () => {
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("loads the snapshot's rows", async () => {
    expect(await count(client, "select count(*)::int as value from master.divisions")).toBe(1);
    expect(await count(client, "select count(*)::int as value from trucking.orders")).toBe(1);
    expect(report.rowCounts["trucking.clients"]).toBe(1);
  });

  it("preserves values that COPY escaping made awkward", async () => {
    const email = await scalar<string>(client, "select email from master.users");
    expect(email).toBe("quote'and\\backslash@example.test");

    const address = await scalar<string>(client, "select address from trucking.clients");
    expect(address).toBe("line one\nline two");

    const nulls = await count(
      client,
      "select count(*)::int as value from trucking.orders where cancel_reason is null"
    );
    expect(nulls).toBe(1);
  });

  it("leaves the excluded tables out of the loaded database", async () => {
    const roles = await count(
      client,
      `select count(*)::int as value from information_schema.tables
        where table_schema = 'spatie'`
    );
    expect(roles).toBe(0);
  });

  it("journals the chain as it runs, so a later migrate applies only the rest", async () => {
    const applied = await count(
      client,
      "select count(*)::int as value from drizzle.__drizzle_migrations"
    );
    expect(applied).toBe(3);
  });

  it("runs the later migrations over the loaded rows", async () => {
    // 0002 gives the ported primary keys their default; the loaded row is untouched
    const defaults = await count(
      client,
      `select count(*)::int as value from information_schema.columns
        where table_schema = 'master' and column_name = 'id'
          and column_default like 'gen_random_uuid%'`
    );
    expect(defaults).toBeGreaterThan(0);
  });

  it("is a no-op when re-run against the same database", async () => {
    // the pipeline resets its target first, so a second run lands in the same
    // place rather than colliding with what the first one left behind
    const second = await importSnapshot(client, snapshotFile, migrationsFolder);

    expect(second.errors).toEqual([]);
    expect(second.warnings).toEqual([]);
    expect(second.checksums).toEqual(report.checksums);
    expect(second.rowCounts).toEqual(report.rowCounts);

    expect(await count(client, "select count(*)::int as value from master.divisions")).toBe(1);
  });

  it("reports deliberately broken data as an error rather than crashing", async () => {
    await withDatabase(async (client) => {
      const broken = await importSnapshot(
        client,
        path.join(testDir, "fixtures", "broken-snapshot.sql"),
        migrationsFolder
      );
      const codes = broken.errors.map((finding) => finding.code).sort();
      // the shape problem names the cause; the row count and the business keys
      // record its consequences
      expect(codes).toEqual(["checksum", "row-count", "row-shape"]);
      expect(summarise(broken)).toContain("row-shape");
    });
  });
});

describe("the verifier", () => {
  it("catches rows orphaned behind an unvalidated foreign key", async () => {
    await withDatabase(async (client) => {
      const clean = await importSnapshot(client, snapshotFile, migrationsFolder);
      expect(clean.errors).toEqual([]);

      // drop the constraint so a parent can go missing, then put it back without
      // validating the rows that already exist — the state a load that bypassed
      // enforcement would leave behind
      await client.exec(
        "alter table master.users drop constraint master_users_division_id_foreign"
      );
      await client.exec(
        `update master.users set division_id = '99999999-9999-4999-8999-999999999999'`
      );
      await client.exec(
        `alter table master.users
           add constraint master_users_division_id_foreign
           foreign key (division_id) references master.divisions(id) not valid`
      );

      const report = await verify(await readSnapshot(snapshotFile), client);
      const finding = report.errors.find((f) => f.code === "fk-integrity");
      expect(finding?.message).toContain("1 row(s)");
      expect(finding?.message).toContain("master.users");
    });
  });

  it("catches a business key that no longer matches the snapshot", async () => {
    await withDatabase(async (client) => {
      await importSnapshot(client, snapshotFile, migrationsFolder);
      await client.exec(`update master.divisions set code = 'WRONG'`);

      const report = await verify(await readSnapshot(snapshotFile), client);
      expect(report.errors.map((f) => f.code)).toContain("checksum");
    });
  });

  it("warns about a snapshot table the manifest does not know", async () => {
    await withDatabase(async (client) => {
      const report = await importSnapshot(
        client,
        path.join(testDir, "fixtures", "unknown-snapshot.sql"),
        migrationsFolder
      );

      const finding = report.warnings.find((f) => f.code === "unknown-table");
      expect(finding?.message).toContain("legacy.something_new");
    });
  });
});

describe("the insert order", () => {
  it("respects every foreign key and covers every legacy table", async () => {
    await withDatabase(async (client) => {
      await importSnapshot(client, snapshotFile, migrationsFolder);

      const edges = await client.query<{ child: string; parent: string }>(
        `select cn.nspname || '.' || cc.relname as child,
                pn.nspname || '.' || pc.relname as parent
           from pg_constraint con
           join pg_class cc on cc.oid = con.conrelid
           join pg_namespace cn on cn.oid = cc.relnamespace
           join pg_class pc on pc.oid = con.confrelid
           join pg_namespace pn on pn.oid = pc.relnamespace
          where con.contype = 'f'`
      );

      const position = new Map(schemaOrder.map((table, index) => [table, index]));

      // the legacy schemas only: Better Auth's tables live in public and are not
      // part of what the pipeline carries
      const legacy = /^(master|warehouse|trucking|expense)\./;
      const legacyEdges = edges.filter(
        (edge) => legacy.test(edge.child) && legacy.test(edge.parent)
      );

      // every table the schema connects is in the order
      const connected = new Set(legacyEdges.flatMap((edge) => [edge.child, edge.parent]));
      const missing = [...connected].filter((table) => !position.has(table));
      expect(missing).toEqual([]);

      // and no parent is inserted after a child that references it
      const violated = legacyEdges.filter(
        (edge) =>
          position.has(edge.child) &&
          position.has(edge.parent) &&
          (position.get(edge.child) as number) < (position.get(edge.parent) as number)
      );
      expect(violated).toEqual([]);
    });
  });
});
