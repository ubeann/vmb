import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { importSnapshot, summarise } from "../src/import/run.js";
import { parseSnapshot } from "../src/import/snapshot.js";
import { loadStatements } from "../src/import/load.js";
import { excludedTables, portedTables } from "../src/import/manifest.js";
import { byPhase, readChain } from "../src/import/phases.js";
import { count, migrationsFolder, scalar } from "./harness.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const snapshotFile = path.join(testDir, "fixtures", "snapshot.sql");

describe("the snapshot parser", () => {
  it("reads a COPY block's columns and rows", async () => {
    const snapshot = await import("../src/import/snapshot.js").then((m) =>
      m.readSnapshot(snapshotFile)
    );

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

  it("undoes COPY escaping, keeping the null marker distinct", () => {
    const snapshot = parseSnapshot(
      ["COPY t.a (x, y, z) FROM stdin;", "quote'and\\\\backslash\ttab\\there\t\\N", "\\."].join(
        "\n"
      )
    );

    expect(snapshot.rows.get("t.a")).toEqual([["quote'and\\backslash", "tab\there", "\\N"]]);
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
    const snapshot = await import("../src/import/snapshot.js").then((m) =>
      m.readSnapshot(snapshotFile)
    );
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
  let client: PGlite;
  let report: Awaited<ReturnType<typeof importSnapshot>>;

  beforeAll(async () => {
    client = new PGlite();
    report = await importSnapshot(client, snapshotFile, migrationsFolder);
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

  it("is a no-op when re-run against the same snapshot", async () => {
    const second = await importSnapshot(new PGlite(), snapshotFile, migrationsFolder);
    expect(second.checksums).toEqual(report.checksums);
    expect(second.rowCounts).toEqual(report.rowCounts);
  });

  it("reports deliberately broken data as an error rather than crashing", async () => {
    const broken = await importSnapshot(
      new PGlite(),
      path.join(testDir, "fixtures", "broken-snapshot.sql"),
      migrationsFolder
    );
    const codes = broken.errors.map((finding) => finding.code).sort();
    // the shape problem names the cause, the row-count problem its consequence
    expect(codes).toEqual(["row-count", "row-shape"]);
    expect(summarise(broken)).toContain("row-shape");
  });
});
