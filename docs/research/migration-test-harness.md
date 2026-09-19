# Migration test-harness research: PGlite vs Docker Postgres vs Neon branch

Research date: **2026-09-19** (all pages, registries and source files accessed on this date).
Stack baseline verified from this repo: `drizzle-orm@^0.45.2`, `drizzle-kit@^0.31.10` (npm `latest` at access date; see `packages/db/package.json`).

Legend: **UNCONFIRMED** = could not be verified from a primary source; not guessed. Every other statement has a citation directly below it.

Use case being evaluated: integration-test a migration chain that (a) applies a `pg_dump --schema-only` baseline of a Laravel/Postgres database with multiple Postgres schemas, (b) runs a data-conversion migration deriving UUIDv4-shaped PKs via **HMAC-SHA256** (needs `hmac()` from pgcrypto), and (c) runs later schema migrations. CI currently runs "with no secrets" and tests mock the DB entirely.

---

## 1. PGlite

### 1.1 Which Postgres version does the current release embed?

**Claim:** The current release is `@electric-sql/pglite@0.5.8` (published 2026-08-26) and it embeds **PostgreSQL 18.3**.

- npm registry `latest` = `0.5.8`; the publish timestamp in the same document is 2026-08-26.
  - https://registry.npmjs.org/@electric-sql/pglite/latest (field `version`, `_npmOperationalInternal.tmp` timestamp) — accessed 2026-09-19
- GitHub release list: `@electric-sql/pglite@0.5.8` marked "Latest", 2026-08-26.
  - https://github.com/electric-sql/pglite/releases — accessed 2026-09-19
- Changelog entry under `0.5.0`: `93d50aa: Upgrade to Postgres 18.3; move other extensions to their own npm packages`.
  - https://raw.githubusercontent.com/electric-sql/pglite/main/packages/pglite/CHANGELOG.md (line 64) — accessed 2026-09-19
- Previous major line was PG 17: changelog `6898469: PostgreSQL 17.5`, `97e52f7: upgrade to postgresql 17.4` (same file, lines 183, 225).
- Build provenance: PGlite is a WASM build of Postgres from the `electric-sql/postgres-pglite` fork; the npm publish was produced by GitHub Actions on Node 24.19.0 (registry metadata `_nodeVersion`).

**UNCONFIRMED:** whether 0.5.8 ships exactly 18.3 (the version bump entry is under 0.5.0 and no later changelog entry lists another Postgres bump; no page explicitly re-states the embedded version for 0.5.8).

### 1.2 Multiple schemas (`CREATE SCHEMA`, schema-qualified DDL)

**Claim:** Supported. PGlite is upstream Postgres compiled to WASM (not a Postgres emulation), and it executes `CREATE SCHEMA` internally for its own metadata.

- PGlite README: "PGlite is a WASM Postgres build packaged into a TypeScript client library … it is simply Postgres in WASM"; the only documented limitation is "PGlite is single user/connection".
  - https://github.com/electric-sql/pglite (README sections "How it works", "Limitations") — accessed 2026-09-19
- PGlite's own `pglite-sync` package runs multi-statement DDL including `CREATE SCHEMA IF NOT EXISTS "<schema>";` and fully schema-qualified table names through `pg.exec`.
  - https://raw.githubusercontent.com/electric-sql/pglite/main/packages/pglite-sync/src/subscriptionState.ts (lines 139–148) — accessed 2026-09-19
- The historical bug where PGlite assumed `search_path` = `public` was closed 2025-05-05 ("in various places in the code we assume that `search_path` is set to `public` … See PR #625").
  - https://github.com/electric-sql/pglite/issues/626 — accessed 2026-09-19

**UNCONFIRMED:** PGlite-specific documentation of schema-qualified `ALTER TABLE`/`CREATE INDEX` syntax. These are core Postgres statements (https://www.postgresql.org/docs/18/ddl-schemas.html, https://www.postgresql.org/docs/18/sql-createschema.html) and PGlite compiles upstream Postgres, so they are expected to work; no PGlite doc or test was found that exercises schema-qualified DDL specifically.

### 1.3 Contrib extensions shipped and how they are loaded

**Claim:** 33 "postgres/contrib" extensions ship with the main package, including `pgcrypto`, `uuid-ossp`, `citext`, `hstore`, `pg_trgm`, `ltree`, `unaccent`, `fuzzystrmatch`, `earthdistance` (+`cube`), `tablefunc`, `btree_gin`/`btree_gist`, `intarray`, `isn`, `lo`, `seg`, `tcn`, `amcheck`, `bloom`, `pg_stat_statements`, `pgcrypto`.

- Extensions catalog (counts: "postgres extension 42 / pglite plugin 1 / postgres/contrib 33 / external 9"; `pgcrypto` entry says "included in the main PGlite package").
  - https://pglite.dev/extensions/ — accessed 2026-09-19

**Loading pattern** (per catalog entries): install `@electric-sql/pglite`, import the extension module from its contrib subpath, pass it to the constructor, then run `CREATE EXTENSION`:

```js
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const pg = new PGlite({ extensions: { pgcrypto } });
await pg.exec("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
```

- Source module: https://raw.githubusercontent.com/electric-sql/pglite/main/packages/pglite/src/contrib/pgcrypto.ts (`name: 'pgcrypto'`, `bundlePath: .../release/pgcrypto.tar.gz`)
  - The catalog marks `pgcrypto` as "postgres/contrib" = bundled in the main npm package (bundle size 1.1 MB); externally distributed extensions (PostGIS, pgvector, etc.) are separate npm packages.

### 1.4 pgcrypto / `hmac()` / `digest()` / `gen_random_uuid()`

**Claim:** `hmac()` and `digest()` work in PGlite; they are covered by PGlite's own extension test suite.

- PGlite test file `tests/contrib/pgcrypto.test.ts`:
  - `hmac`: `SELECT encode(hmac(convert_to('test','UTF8'), convert_to('key','UTF8'), 'sha1'), 'hex')` (line 38–40)
  - `digest`: `SELECT encode(digest(convert_to('test','UTF8'), 'sha1'), 'hex')` (line 31–33)
  - `gen_random_uuid()`: `SELECT gen_random_uuid() as uuid;` (line 165–166) — executed through the pgcrypto-loaded instance
  - https://raw.githubusercontent.com/electric-sql/pglite/main/packages/pglite/tests/contrib/pgcrypto.test.ts — accessed 2026-09-19
- `hmac()` signatures (Postgres 18 docs): `hmac(data text, key text, type text) returns bytea` and `hmac(data bytea, key bytea, type text) returns bytea`; supported types include `sha256`. SHA-256 HMAC therefore needs no custom function.
  - https://www.postgresql.org/docs/18/pgcrypto.html — accessed 2026-09-19
- `gen_random_uuid()` is core Postgres (built in since PG 13; PGlite embeds 18.3), not dependent on pgcrypto.
  - https://www.postgresql.org/docs/18/functions-uuid.html — accessed 2026-09-19

### 1.5 `pg_dump`/`pg_restore`-style SQL input, `--> statement-breakpoint`, DDL

**Claim:** A real plain-SQL dump can be executed; PGlite's own upgrade path is dump→`exec`. A `pg_dump --schema-only` output from a regular Postgres 15 instance was restored successfully in a PGlite-backed server.

- PGlite maintainers' documented upgrade path is "use `pg_dump` to create a database dump from the previous version of PGlite and then import into a new instance", restoring with `pg.exec(await dumpResult.text())`.
  - https://pglite.dev/docs/upgrade — accessed 2026-09-19
- `@electric-sql/pglite-tools` ships a WASM build of `pg_dump` (`pgDump({ pg, args, fileName })`, always adds `--inserts`, `-j 1`, `-f /tmp/out.sql`, `-U postgres`). It does **not** ship `pg_restore`, so only **plain SQL text** (from `pg_dump`, or `pg_restore` converted to plain) can be fed to PGlite — custom-format archives cannot be restored.
  - https://pglite.dev/docs/pglite-tools (section `pgDump`, options/returns/caveats) — accessed 2026-09-19
- `pg.exec()` "supports multiple statements" and is documented as "perfect for migrations and batch inserts with raw SQL".
  - https://pglite.dev/docs/ — accessed 2026-09-19
- Real-world confirmation (issue #911, closed 2026-03-11): a dump from "a regular postgresql instance (v15)" restores into PGlite. The reporter hit an error only with **data** (`COPY public.mytable … FROM stdin;` over the pglite-socket/psql path), and states: "If a dump is created with `--schema-only` option, the restore operation finishes successfully."
  - https://github.com/electric-sql/pglite/issues/911 — accessed 2026-09-19
- `--> statement-breakpoint` is a **Drizzle** convention, not Postgres: Drizzle's migrator reads each `migration.sql` and splits on the literal `'--> statement-breakpoint'` before executing statements one by one (`drizzle-orm/src/migrator.ts`, line 44). PGlite never sees the marker; `db.exec()` runs the whole text and `migrate()` runs pre-split statements.
  - https://raw.githubusercontent.com/drizzle-team/drizzle-orm/0.45.2/drizzle-orm/src/migrator.ts (lines 22–53) — accessed 2026-09-19

### 1.6 Documented limitations relevant to applying a real `pg_dump --schema-only`

- **Single user / single connection** (README "Limitations") — irrelevant to a sequential, single-file schema-only restore; it only rules out parallel restore and multi-client concurrency.
  - https://github.com/electric-sql/pglite — accessed 2026-09-19
- **`COPY … FROM stdin` (data sections) fails** over the socket path (issue #911). `--schema-only` output contains no table `COPY` data sections, so this does not apply to the baseline. In-process `pg.exec(dumpText)` would only be affected if the dump contained `COPY … FROM stdin` blocks (it does not for schema-only).
  - https://github.com/electric-sql/pglite/issues/911 — accessed 2026-09-19
- **`OBJECT OWNER TO` / `GRANT` statements**: stock `pg_dump` emits ownership and ACL statements unless `--no-owner`/`--no-acl` (or `--no-privileges`) are passed; a dump therefore references roles (e.g. the Laravel DB owner) that may not exist in the embedded instance. Whether PGlite can `CREATE ROLE` was not documented or searchable in the repo; **UNCONFIRMED**. Mitigation (recommendation, not doc): dump with `--no-owner --no-acl`, or strip `OWNER TO`/`GRANT`/`REVOKE` lines before applying.
- **Extensions outside the shipped catalog** would fail at `CREATE EXTENSION`; the baseline can only use the extensions listed in https://pglite.dev/extensions/.
- Background workers and checkpointer are disabled in PGlite 0.4.x (`65fc101: Disable background workers`, `b88c5c3: Disable checkpointer`, changelog) — no impact on DDL restore.
- No documented `pg_dump`/`pg_restore` version matrix beyond the issue #911 PG15→PGlite schema-only success; cross-major restore of schema-only SQL is otherwise **UNCONFIRMED** for other dump versions.

### 1.7 Node 24+ and GitHub Actions

**Claim:** Yes. PGlite requires Node `>=20`, is tested in CI on Node `20.x, 21.x, 22.x, 23.x, 24.x`, and needs no services in CI.

- `engines.node: ">=20"` in the repo root package.json.
  - https://raw.githubusercontent.com/electric-sql/pglite/main/package.json — accessed 2026-09-19
- CI workflow matrix includes `24.x`; jobs run on `ubuntu-latest` (light jobs) and `blacksmith-32vcpu-ubuntu-2204` (heavy WASM build jobs).
  - https://raw.githubusercontent.com/electric-sql/pglite/main/.github/workflows/build_and_test.yml (lines 24, 203, 321) — accessed 2026-09-19
- PGlite's documented use case includes "**Unit and CI testing** — PGlite is very fast to start and tear down. It's perfect for unit tests — you can have a unique fresh Postgres for each test."
  - https://pglite.dev/docs/about — accessed 2026-09-19
- No Docker, no service container, no network: it is an npm dependency ("with no need to install any other dependencies").
  - https://github.com/electric-sql/pglite (README) — accessed 2026-09-19

---

## 2. Docker Postgres in GitHub Actions

**Minimum service config** (official GitHub docs pattern): `image: postgres` + `env.POSTGRES_PASSWORD` + a health check (`pg_isready`); add `ports: 5432:5432` only when the job runs directly on the runner (use `localhost`); when the job runs in a container, no port mapping is needed and the hostname is the service label (`postgres`). Linux runner (`ubuntu-*`) required for service containers.

- https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers (sections "Running jobs directly on the runner machine" / "Running jobs in containers") — accessed 2026-09-19

```yaml
services:
  postgres:
    image: postgres:18
    env:
      POSTGRES_PASSWORD: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

**Multiple schemas:** core Postgres feature, no extra config.

- https://www.postgresql.org/docs/18/ddl-schemas.html (CREATE SCHEMA, schema-qualified names, search_path) — accessed 2026-09-19

**pgcrypto out of the box:** yes, for the Debian-based official image.

- The official image Dockerfile installs the distro server package `postgresql-$PG_MAJOR` (built via `apt-get source --compile "postgresql-$PG_MAJOR=$PG_VERSION"` from the PGDG repo).
  - https://raw.githubusercontent.com/docker-library/postgres/master/Dockerfile-debian.template (lines 132–133, 151–152) — accessed 2026-09-19
- The Debian `postgresql-18` package file list includes `/lib/pgcrypto.so` and the `extension/pgcrypto--*` control files, i.e. contrib ships inside the server package, not a separate install.
  - https://packages.debian.org/sid/amd64/postgresql-18/filelist — accessed 2026-09-19
- The official image docs note that on Debian-based variants "installing additional extensions … should be as simple as installing the relevant packages" and that extensions beyond `postgres-contrib` must be compiled; `pgcrypto` is in `postgres-contrib` (https://www.postgresql.org/docs/14/contrib.html).
  - https://raw.githubusercontent.com/docker-library/docs/master/postgres/README.md (section "Additional Extensions") — accessed 2026-09-19

**Secrets:** none required for the standard pattern — the password is a literal workflow value (`POSTGRES_PASSWORD: postgres` in the GitHub docs example). No repository secret is needed.

---

## 3. Neon extensions

**Claim:** `pgcrypto` and `uuid-ossp` are both available on Neon.

- Neon extension list: `pgcrypto` version **1.3** on PG14–17 and **1.4** on PG18; `uuid-ossp` version **1.1** on PG14–18, with the note: 'Double-quote the extension name when installing: `CREATE EXTENSION "uuid-ossp"`'.
  - https://neon.com/docs/extensions/pg-extensions (extension table) — accessed 2026-09-19
- Neon's pgcrypto page documents the HMAC use case directly: "`hmac(data, key, type)` … `hmac('Data to Authenticate', 'shared_secret_key', 'sha256');`".
  - https://neon.com/docs/extensions/pgcrypto — accessed 2026-09-19
- How extensions are enabled: from a Postgres client (psql, SQL editor, `neonctl`/API), run `CREATE EXTENSION <name>;` (or `ALTER EXTENSION … UPDATE`); the pg-extensions page is the canonical availability list and has an "Install an extension" section.
  - https://neon.com/docs/extensions/pg-extensions (sections "Postgres extensions", "Install an extension") — accessed 2026-09-19

**CI caveat (for the recommendation table):** automating a throwaway Neon branch requires a Neon **API key** (`$NEON_API_KEY`) in the CI environment, i.e. a repository secret.

- https://neon.com/docs/guides/branching-neon-api ("API key, which you must provide when making a Neon API request") — accessed 2026-09-19

---

## 4. Drizzle Kit + a test database

**Claim:** There is no documented programmatic entry point for `drizzle-kit` itself; the documented way to apply generated migrations without the CLI is the `migrate()` function exported from the driver-specific `drizzle-orm/*/migrator` modules.

- Drizzle docs "Migrations" describe six approaches; Option 4 ("…I want Drizzle to apply them during runtime") shows:
  ```ts
  import { drizzle } from "drizzle-orm/node-postgres";
  import { migrate } from "drizzle-orm/node-postgres/migrator";

  const db = drizzle(process.env.DATABASE_URL);

  await migrate(db);
  ```
  - https://orm.drizzle.team/docs/migrations (Option 4) — accessed 2026-09-19
- Caveat: that docs snippet omits the (now required) second argument. In drizzle-orm 0.45.2 the signature is `migrate(db, config)` with `config = { migrationsFolder: string; migrationsTable?: string; migrationsSchema?: string }`.
  - https://raw.githubusercontent.com/drizzle-team/drizzle-orm/0.45.2/drizzle-orm/src/migrator.ts (`MigrationConfig`, lines 9–13) — accessed 2026-09-19

**neon-http migrator — import path and signature:**

```ts
import { migrate } from "drizzle-orm/neon-http/migrator";
// migrate(db: NeonHttpDatabase<TSchema>, config: MigrationConfig)
```

- Source: https://raw.githubusercontent.com/drizzle-team/drizzle-orm/0.45.2/drizzle-orm/src/neon-http/migrator.ts — accessed 2026-09-19
  - Creates `__drizzle_migrations` in the `drizzle` schema by default (`migrationsSchema ?? 'drizzle'`).
  - **Explicit source warning:** "The Neon HTTP driver does not support transactions. This means that if any part of a migration fails, no rollback will be executed." It executes each statement individually and inserts the history row after each migration.

**Does it work against PGlite or a plain `pg` connection instead?** Not the neon-http one (it is typed to `NeonHttpDatabase`), but equivalent migrators exist for both, same `(db, config)` shape, and these delegate to the dialect's transactional `migrate`:

- PGlite: `import { migrate } from 'drizzle-orm/pglite/migrator'` — `migrate(db: PgliteDatabase<TSchema>, config: MigrationConfig)`; PGlite driver import path is `drizzle-orm/pglite`.
  - https://raw.githubusercontent.com/drizzle-team/drizzle-orm/0.45.2/drizzle-orm/src/pglite/migrator.ts — accessed 2026-09-19
  - https://orm.drizzle.team/docs/connect-pglite (`drizzle-orm/pglite` import) — accessed 2026-09-19
- Plain `pg` (node-postgres): `import { migrate } from 'drizzle-orm/node-postgres/migrator'` — `migrate(db: NodePgDatabase<TSchema>, config: MigrationConfig)`.
  - https://raw.githubusercontent.com/drizzle-team/drizzle-orm/0.45.2/drizzle-orm/src/node-postgres/migrator.ts — accessed 2026-09-19

**`--> statement-breakpoint` handling:** done by `readMigrationFiles()` inside `migrate()` — it reads `meta/_journal.json`, then splits each `.sql` on `'--> statement-breakpoint'` (line 44). The migrator also requires `meta/_journal.json` to exist next to the migration files.

- https://raw.githubusercontent.com/drizzle-team/drizzle-orm/0.45.2/drizzle-orm/src/migrator.ts — accessed 2026-09-19

**UNCONFIRMED:** a `drizzle-kit migrate` (CLI) programmatic API — no docs page or export for embedding the kit CLI in a test was found; the supported programmatic path is the drizzle-orm migrator above.

---

## 5. Recommendation

| Harness                                     | Multi-schema                                                                                                                                                                                                                                                                                                                                        | pgcrypto / HMAC                                                                                                                                                                                                                                                                       | pg_dump fidelity                                                                                                                                                                                                                                                                                                                               | CI cost                                                                                                                                                                                                | Secret-free                                                                                                            | Verdict                                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PGlite 0.5.8** (PG 18.3, in-process)      | **Supported** — upstream Postgres; `CREATE SCHEMA` used by pglite-sync; search_path bug fixed ([README](https://github.com/electric-sql/pglite), [subscriptionState.ts](https://raw.githubusercontent.com/electric-sql/pglite/main/packages/pglite-sync/src/subscriptionState.ts), [issue #626](https://github.com/electric-sql/pglite/issues/626)) | **Supported** — pgcrypto in main package + `hmac`/`digest` in PGlite's test suite ([catalog](https://pglite.dev/extensions/), [test](https://raw.githubusercontent.com/electric-sql/pglite/main/packages/pglite/tests/contrib/pgcrypto.test.ts)); `gen_random_uuid()` core since PG13 | **Partial** — plain-SQL `--schema-only` restore confirmed ([issue #911](https://github.com/electric-sql/pglite/issues/911)); no `pg_restore` custom format (only `pgDump` shipped — [pglite-tools](https://pglite.dev/docs/pglite-tools)); owner/ACL statements UNCONFIRMED; only the shipped extension catalog is available (33 contrib ext.) | **Lowest** — npm dep, no service/container, fresh instance per test ([about](https://pglite.dev/docs/about))                                                                                           | **Yes** — no secrets, no network                                                                                       | **Recommend as the default harness for the migration chain** (baseline SQL must be plain `--schema-only`, prefer `--no-owner --no-acl`)                         |
| **Docker Postgres** (`postgres:18` service) | **Supported** — core Postgres ([docs](https://www.postgresql.org/docs/18/ddl-schemas.html))                                                                                                                                                                                                                                                         | **Supported** — pgcrypto ships in the server package ([Dockerfile](https://raw.githubusercontent.com/docker-library/postgres/master/Dockerfile-debian.template), [Debian filelist](https://packages.debian.org/sid/amd64/postgresql-18/filelist))                                     | **Full** — it is the real server; any `pg_dump`/`pg_restore` form applies                                                                                                                                                                                                                                                                      | **Medium** — image pull + service startup on every job; Ubuntu runner required ([GitHub docs](https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers)) | **Yes** — password is a literal in the workflow; no repo secret needed (same docs)                                     | **Keep as a fidelity/parity job**: run the same migration chain here at least once in CI (and for tests needing `pg_restore`, roles, or non-bundled extensions) |
| **Neon branch** (throwaway project branch)  | **Supported** — real Postgres                                                                                                                                                                                                                                                                                                                       | **Supported** — pgcrypto 1.3 (PG14–17) / 1.4 (PG18); uuid-ossp 1.1 ([pg-extensions](https://neon.com/docs/extensions/pg-extensions), [pgcrypto](https://neon.com/docs/extensions/pgcrypto))                                                                                           | **Full** for SQL, but applying a baseline over the network and per-run branch lifecycle adds moving parts                                                                                                                                                                                                                                      | **Highest** — branch creation/teardown + network round-trips; needs API key and `DATABASE_URL`                                                                                                         | **No** — branch automation requires `$NEON_API_KEY` ([branching API](https://neon.com/docs/guides/branching-neon-api)) | **Not for the default CI job.** Use as an optional pre-release/parity check (or for the "no secrets" CI, skip)                                                  |

**Summary recommendation:** use **PGlite** as the secret-free, in-process integration harness for the migration chain (schema-only dump baseline + HMAC data conversion + later migrations), with the baseline dumped as plain SQL (`--schema-only`, ideally `--no-owner --no-acl`) and restored via `pg.exec()`/Drizzle `migrate()` from `drizzle-orm/pglite/migrator`. Add one CI job against a **Docker `postgres` service container** to cover pg_dump fidelity beyond what PGlite's schema-only path proves (parallel restore formats, roles/ACLs, non-bundled extensions). Treat **Neon branches** as an occasional manual/parity environment, not the "no secrets" CI path.

**Repo-specific note:** the baseline spans 7 Postgres schemas (`public`, `spatie`, `master`, `auth`, `trucking`, `warehouse`, `expense`; see `docs/research/legacy-schema-inventory.md`), which all three harnesses handle; the deciding factors are the pg_dump fidelity edge cases and the no-secrets CI constraint.
