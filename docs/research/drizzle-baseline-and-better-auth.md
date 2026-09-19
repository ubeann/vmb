# Research: Drizzle Kit baselines for an existing DB, and Better Auth user import

Researched 2026-09-19 against primary sources (official docs, the source repos, and the exact
package versions installed in this workspace). Every claim below carries the source URL and the
section (or source file/line for code), plus the version it applies to.

**Versions that matter for this repo**

- `drizzle-kit@0.31.10`, `drizzle-orm@0.45.2` (`packages/db/package.json`) — this is the **v0.x**
  layout: flat `<out>/<tag>.sql` files plus `<out>/meta/_journal.json` and
  `<out>/meta/NNNN_snapshot.json`. Confirmed locally: `packages/db/drizzle/0000_better_auth_schema.sql`
  - `packages/db/drizzle/meta/_journal.json` (`"version": "7"`).
- The public docs at `https://orm.drizzle.team/docs` currently document **Drizzle v1 (beta)**
  (banner: “We've merged alternation-engine into Beta release… v1.0.0-beta.2”). v1 changes the
  migration folder layout to one folder per migration (`migration.sql` + `snapshot.json` inside).
  Where v0 and v1 differ, both are stated explicitly.
- `better-auth@1.7.4` / `@better-auth/core@1.7.4` installed in this workspace; docs at
  `https://www.better-auth.com/docs` document the 1.x config shape.

---

# Question 1 — Drizzle Kit baseline migrations for an existing database

## 1.1 Hand-authoring/adopting a baseline migration, and how `generate` computes diffs

**How `generate` works (v0 and v1).** `generate` reads the Drizzle schema, composes a JSON snapshot,
reads previous migrations, compares the current snapshot to the most recent one, and writes
`migration.sql` + `snapshot.json` for the diff.
Source: `drizzle-kit generate` → “How it works under the hood?”,
<https://orm.drizzle.team/docs/drizzle-kit-generate>. Applies to v1 docs; behaviour is the same in
v0.31.10 (see below).

**Where snapshots and journal entries are written (v0.31.10, the version in this repo).** The CLI
always writes a snapshot file into `meta/`, appends an entry to `meta/_journal.json`, and writes the
SQL file, in one `writeResult()` call:
`node_modules/.pnpm/drizzle-kit@0.31.10/node_modules/drizzle-kit/bin.cjs` (npm package
`drizzle-kit@0.31.10`), bundled `bin.cjs`:

- `prepareOutFolder()` creates `meta/_journal.json` on first use (L8127–8138).
- `writeResult()` writes `meta/<idx>_snapshot.json`, appends `{idx, version, when, tag, breakpoints}`
  to `_journal.json`, and writes `<out>/<tag>.sql` (L32902–32970).
- `preparePgMigrationSnapshot()` (L19848+) serializes `schema.ts` for `cur`; `preparePrevSnapshot()`
  (L19862+) reads the **last snapshot file in `meta/`** as `prev`.

Because `generate` diffs against the last snapshot in `meta/`, a baseline is correct only if a
snapshot that describes the legacy schema exists in `meta/` before the next `generate` run.

**Custom (hand-written) migrations.** `drizzle-kit generate --custom --name=<name>` creates an empty
SQL file intended for hand-written SQL:
Source: `generate` → “Custom migrations”, <https://orm.drizzle.team/docs/drizzle-kit-generate> and
“Migrations with Drizzle Kit” → custom migrations flow, <https://orm.drizzle.team/docs/kit-custom-migrations>.

**Critical detail (source-verified for v0.31.10 and v1):** the snapshot written for a `--custom`
migration is **the previous snapshot with new ids** — it does _not_ capture the current `schema.ts`
nor any SQL you paste into the file. In v0.31.10: `bin.cjs` L19848–19860:

```js
const { id: _ignoredId, prevId: _ignoredPrevId, ...prevRest } = prevSnapshot;
const custom2 = { id, prevId: idPrev, ...prevRest }; // <- custom snapshot = old schema
```

The v1 source carries the same comment verbatim: “that's for custom migrations, when we need new IDs,
but old snapshot” — `drizzle-kit/src/migrationPreparator.ts` L97–104,
<https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-kit/src/migrationPreparator.ts>.

**Empirical verification (this workspace, drizzle-kit 0.31.10).** In a scratch schema with two
`pgSchema`s and a `default(sql\`uuidv7()\`)` column:

- `generate --name=init` emitted `CREATE SCHEMA "legacy"; CREATE SCHEMA "master";` plus
  schema-qualified tables, and wrote `drizzle/meta/0000_snapshot.json` + `_journal.json`.
- Running `generate --custom --name=baseline` as migration 0000 and then `generate --name=next`
  produced `0001_next.sql` containing `CREATE TABLE "users" (...)` again — proof that a `--custom`
  baseline does not tell `generate` that the tables already exist.

**Verdict for the exact ask (pg_dump `--schema-only` as `0000`).**
There is **no single official “baseline” doc page**. The official docs only give the two supported
directions: _database first_ (adopt an existing DB with `pull`) and _codebase first_ (`generate` from
`schema.ts`). The “Migrations for teams” page explicitly says: “This section will be updated right
after our release of the next version of migrations folder structure.”
Source: <https://orm.drizzle.team/docs/kit-migrations-for-teams>.

The workflow below is the one that follows from the documented commands and the source behaviour;
items marked _(source-derived)_ are not written out end-to-end in the docs:

1. _(source-derived, database-first)_ Point `drizzle.config.ts` at a scratch database loaded with the
   pg_dump. Run `drizzle-kit pull` (v0.31.10: alias of `introspect`). It writes `schema.ts` +
   `relations.ts` and, when no migrations exist yet, a `0000_*.sql` (v0) whose DDL is wrapped in a
   comment, plus a correct snapshot + journal entry (see 1.2). Replace the commented DDL with the
   real pg_dump SQL, or uncomment the generated DDL. Subsequent `generate` calls diff against the
   snapshot and only emit new changes.
2. _(source-derived, codebase-first)_ Put the legacy schema in `schema.ts` (hand-written or pulled)
   and run plain `drizzle-kit generate --name=baseline`. This emits the full DDL for the legacy
   schema **and** a snapshot of it. Do **not** use `--custom` for this (see above).
3. Existing production DB that already matches the baseline: run `drizzle-kit migrate` only on empty
   databases; on the legacy DB, mark `0000` as applied (see 1.3 / 1.5).

## 1.2 `drizzle-kit introspect` / `drizzle-kit pull`

**Naming.** In v0.31.10 the command is `introspect` with alias `pull`:
`drizzle-kit introspect --help` → “Aliases: introspect, pull” (verified by running
`drizzle-kit@0.31.10/bin.cjs introspect --help`). The v1 docs document it as `pull`:
<https://orm.drizzle.team/docs/drizzle-kit-pull>.

**What it does (docs).** “`drizzle-kit pull` lets you literally pull(introspect) your existing
database schema and generate `schema.ts` drizzle schema file, it is designed to cover **database
first** approach.” It requires `dialect` + credentials. “Initial pull — You can use the `--init`
flag to mark the pulled schema as an applied migration in your database, so that all subsequent
migrations are diffed against the initial one.”
Sources: <https://orm.drizzle.team/docs/drizzle-kit-pull> → “How it works under the hood”, “Initial pull”;
the same “database first (Option 1)” framing is in <https://orm.drizzle.team/docs/migrations>.

**What it actually emits in v0.31.10 (source-verified).** `introspectPostgres()` writes
`<out>/schema.ts` and `<out>/relations.ts`, then calls `prepareOutFolder()`; **if no snapshots exist**
it generates the SQL diff against an empty schema and calls `writeResult({type: "introspect"})`,
which stores the SQL **commented out** — “Current sql file was generated after introspecting the
database / If you want to run this migration please uncomment this code before executing migrations”
— plus a real snapshot and journal entry. If snapshots already exist it prints “No SQL generated, you
already have migrations in project” and writes only the schema files.
Source: `drizzle-kit@0.31.10`, `bin.cjs` L86501–86589 (`introspectPostgres`), L32939–32945
(`type === "introspect"` comment wrapping). The same pattern exists for MySQL/SingleStore/SQLite.

**Filtering.** `pull` “will by default manage all tables in all schemas”, configurable with
`tablesFilter`, `schemaFilter`, `extensionsFilters` (`schemaFilter` default `"*"`).
Source: <https://orm.drizzle.team/docs/drizzle-kit-pull> → “Including tables, schemas and extensions”.

**Version caveat / UNCONFIRMED.** The `--init` flag is documented on the v1 `pull` page, but it is
**not present** in `drizzle-kit/src/cli/commands/introspect.ts` on the repo’s `main` branch (which is
the v1 beta code) at the time of this research — no `init` option appears in that file
(<https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-kit/src/cli/commands/introspect.ts>).
Treat “pull --init” as **documented-in-v1-docs, UNCONFIRMED in source**. It does not exist in
v0.31.10 (its `introspect --help` lists no `--init`).

## 1.3 Do custom/hand-written migrations get a journal entry and a snapshot?

**Yes for `generate --custom`** (v0.31.10, source-verified): `writeResult()` is called with
`type: "custom"` and writes a snapshot, journal entry, and the placeholder SQL file (`-- Custom SQL
migration file, put your code below! --`). Source: `bin.cjs` L32169–32184 (custom branch) and
L32902–32970 (`writeResult`). The snapshot content is the previous schema (1.1), so custom migrations
do not advance the schema diff state.

**No for a manually dropped-in `.sql` file.** Migrations are discovered only through the journal:

- `generate` reads `meta/` snapshots (`preparePrevSnapshot`, `bin.cjs` L19862+) — nothing else.
- `drizzle-kit migrate` (and `drizzle-orm`’s migrator) reads `meta/_journal.json` and loads each
  `entry.tag` `.sql`; a `.sql` file with no journal entry is never executed. Source (v0.45.2):
  `drizzle-orm/migrator.js` L3–29 (`readMigrationFiles`).
- `drizzle-kit check` “lets you check consistency of your generated SQL migrations history”
  (<https://orm.drizzle.team/docs/drizzle-kit-check>); in a scratch test it printed “Everything's
  fine 🐶🔥” with an orphan `0002_handwritten.sql` present — it only validates journal↔snapshot
  consistency, not untracked SQL files.

**Remedy.** Use `drizzle-kit generate --custom` (entry + snapshot are created for you) and write the
SQL inside the generated file — this is the documented custom-migration flow. `drizzle-kit up` is
**not** a remedy for missing snapshots: it “lets you upgrade drizzle schema snapshots to a newer
version… required whenever we introduce breaking changes to the json snapshots”
(<https://orm.drizzle.team/docs/drizzle-kit-up>); source-verified `upPgHandler()` only rewrites
existing snapshot JSON to v7 (`bin.cjs` L91809–91826). It never creates a snapshot.

For a baseline specifically, the snapshot must describe the legacy schema, so it has to come from
`pull`/`introspect` (DB-derived) or from a normal `generate` (code-derived) — not from `--custom`.
If you must commit a hand-crafted snapshot/journal pair, keep `prevId`/`id` chaining valid or
`drizzle-kit check` will flag it (same check page).

## 1.4 Multiple Postgres schemas

**Declaring them.** `pgSchema("name")` + `mySchema.table(...)` is the documented way; the docs example
shows the generated DDL including `CREATE SCHEMA`.
Source: <https://orm.drizzle.team/docs/schemas> (“Table schemas”).

**`generate` handles non-`public` schemas** (empirically verified with drizzle-kit 0.31.10): a schema
with `pgSchema("legacy")` and `pgSchema("master")` generated
`CREATE SCHEMA "legacy"; … CREATE SCHEMA "master";` and schema-qualified `CREATE TABLE`s; the
snapshot contains a `"schemas": { "legacy": "legacy", "master": "master" }` map. Source corroborates:
the PG serializer emits `pgSchema` imports for tables whose `schema !== "public"` and qualifies
identifier/param names per schema (`bin.cjs` `schemaToTypeScript4`, L85212+).

**`pull`/`introspect` handle more than `public`** by default — “will by default manage all tables in
all schemas”; restrict with `schemaFilter`.
Source: <https://orm.drizzle.team/docs/drizzle-kit-pull> → “Including tables, schemas and extensions”;
v0.31.10 CLI exposes `--schemaFilters`/`schemaFilter`. Note the v1 config-page spelling is
`schemaFilter` while v0.31.10’s CLI option is `schemaFilters` (singular/plural difference — verify
against the installed CLI’s `introspect --help`).

## 1.5 `migrate` vs `push` for a chain that starts with a baseline; the journal table

**`migrate` vs `push` (documented guidance).** The migrations overview distinguishes:
Option 2 = `push` is “the best approach for rapid prototyping”; Option 3 = “generate SQL migration
files … and apply them … with `drizzle-kit generate` and `drizzle-kit migrate`”. Option 1 =
`pull` for database-first. For a baseline chain, codebase-first (Option 3) is the documented fit.
Source: <https://orm.drizzle.team/docs/migrations> → Options 1–3; `push` does not use the journal at
all (it diffs the live DB against `schema.ts`).

**`__drizzle_migrations` (v0.45.2 / v1 docs).** “Upon running migrations Drizzle Kit will persist
records about successfully applied migrations in your database… `__drizzle_migrations` in `drizzle`
schema”, configurable via `migrations: { table, schema }`.
Source: <https://orm.drizzle.team/docs/drizzle-kit-migrate> → “Applied migrations log in the database”.
Source-verified behaviour in `drizzle-orm@0.45.2`, `pg-core/dialect.js` L43–75:
table `drizzle.__drizzle_migrations (id SERIAL PK, hash text NOT NULL, created_at bigint)`; it reads
the **latest row by `created_at`** and runs every migration whose `folderMillis` is greater; on run it
inserts `(hash, created_at)`.

**How the hash/created_at are computed (needed to mark a baseline applied).**
`drizzle-orm@0.45.2/migrator.js` L3–29: for each `_journal.json` entry, `folderMillis = entry.when`,
`hash = sha256(entire .sql file content)`, statements split on `--> statement-breakpoint`.
So on a database that already contains the legacy schema you can mark baseline `0000` applied by
inserting one row into `drizzle.__drizzle_migrations` with `hash = sha256(<0000 file>)` and
`created_at = <journal entry .when>`. _(source-derived; not documented as a command by Drizzle — no
official “baseline mark” command exists.)_

## 1.6 Custom SQL defaults (`default(sql\`uuidv7()\`)`) and round-trip

- **Generate:** emitted verbatim. Empirical (0.31.10): a column defined as
  `uuid("id").default(sql\`uuidv7()\`)`generated`"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL`,
and the snapshot stored `"default": "uuidv7()"`(snapshot format v7).`defaultNow()`→`now()`.
- **Pull/introspect:** the PG introspector maps expression defaults to `sql\`...\``in the emitted`schema.ts`: `mapColumnDefault4 = (defaultValue, isExpression) => isExpression ? \`sql\\\`${defaultValue}\\\`\` : defaultValue`
(`bin.cjs`L85212–85216). So a DB-level expression default such as`uuidv7()`round-trips as`default(sql\`uuidv7()\`)` when the introspector classifies it as an expression _(function defaults
  are classified as expressions; the exact classification logic was not exercised against a live DB
  here — see UNCONFIRMED)_.

---

# Question 2 — Better Auth: importing an existing user base

## 2.1 Password hashing: default, custom bcrypt verify, and rehash-on-login

**Default algorithm: `scrypt`.** “Better Auth uses `scrypt` to hash passwords… We decided to use
`scrypt` because it's natively supported by Node.js.” Passwords are “stored inside the `account`
table with `providerId` set to `credential`.”
Source: <https://www.better-auth.com/docs/authentication/email-password> → “Configuration” →
“Password”.
Source (1.7.4): `better-auth/dist/crypto/password.mjs` delegates to
`@better-auth/utils/password` (`hashPassword`/`verifyPassword`; Node uses `node:crypto` scrypt);
defaults are taken when no `emailAndPassword.password` override is set
(`better-auth/dist/context/create-context.mjs` L183–184: `hash: options.emailAndPassword?.password?.hash || hashPassword`).

**Custom `hash`/`verify` are supported and are the documented way to verify an existing algorithm.**
Exact config shape (docs type + installed types):

```ts
emailAndPassword: {
  enabled: true,
  password: {
    hash: async (password: string) => Promise<string>,
    verify: async ({ hash, password }: { hash: string; password: string }) => Promise<boolean>,
  },
}
```

Sources: <https://www.better-auth.com/docs/reference/options> → `emailAndPassword` (shows the same
shape); the same page documents defaults (`enabled: false`, `minPasswordLength: 8`,
`maxPasswordLength: 128`). Type source (1.7.4): `@better-auth/core/dist/types/init-options.d.mts`
L738–744. The docs give an Argon2 example at
<https://www.better-auth.com/docs/authentication/email-password> → “Configuration” → “Password”.

**Bcrypt specifically is documented in the official migration guides** (this is the primary source
you were looking for):

- Supabase guide → “Change password hashing algorithm”: “Since Supabase uses `bcrypt`, you'll need to
  configure Better Auth to use bcrypt for password verification.”
  ```ts
  password: {
    hash: async (password) => await bcrypt.hash(password, 10),
    verify: async ({ hash, password }) => await bcrypt.compare(password, hash),
  }
  ```
  <https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/supabase-migration-guide.mdx>
  (rendered: <https://www.better-auth.com/docs/guides/supabase-migration-guide>), lines ~969–1004.
  The Clerk guide has the same note and config
  (<https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/clerk-migration-guide.mdx>).
  Laravel’s bcrypt hashes (`$2y$…`) are the same algorithm family; using `bcrypt.compare` as
  `verify` is the documented pattern. _(No Laravel-specific guide exists — see UNCONFIRMED.)_

**Sign-in flow (source, 1.7.4).** `sign-in.mjs` finds the credential account by
`providerId === "credential" && accountId === user.id`, calls `ctx.context.password.verify({hash, password})`,
and on success creates the session. There is **no automatic re-hash after a successful verify** —
nothing writes back to `account.password`.
Source: `better-auth/dist/api/routes/sign-in.mjs` L316–350.

**Lazy migration/rehash-on-login.** No documented mechanism exists for rehashing on login, and the
source shows none. What the docs support instead is accepting the legacy algorithm permanently via
custom `hash`/`verify` (as Supabase/Clerk guides do — new passwords keep using bcrypt). Rehashing
only happens when the library itself writes a password (`signUp`, `resetPassword`, `changePassword`)
using the configured `hash`. Any “verify bcrypt, then upgrade to scrypt” flow is **UNCONFIRMED** (no
official recipe; `verify` receives no DB/context and cannot write).

## 2.2 Custom table & column names; required columns for the four core tables

**Better Auth does not need to own the default names.** Both table and column names are mappable:

- `user.modelName`, `session.modelName`, `account.modelName`, `verification.modelName` (defaults
  `user`/`session`/`account`/`verification`) and per-field `fields: { ... }` maps exist for all four.
  Docs: <https://www.better-auth.com/docs/concepts/database> → “Custom Table Names”;
  <https://www.better-auth.com/docs/reference/options> → `user`, `session`, `account`, `verification`.
  (The config reference lists `modelName`/`fields` for `verification` as well.)
- With the Drizzle adapter, you can instead keep original property names in `schema.ts` and give the
  DB column a different name, or pass a remapped `schema` object to the adapter; `usePlural` and
  `schemaName` (Postgres namespace) are also supported.
  Source: <https://www.better-auth.com/docs/adapters/drizzle> → “Modifying Table Names”,
  “Modifying Field Names”, “Using Plural Table Names”, “Custom Schema namespace”.
- Targeting an existing `master.users` table: use `schemaName: "master"` (adapter) or declare the
  Drizzle table in `pgSchema("master")` and map `user.modelName`/schema accordingly. The docs’ custom
  namespace example shows `pgSchema("auth")` + `authSchema.table("user", …)`.

**Required columns and types (better-auth 1.7.4).** Authoritative field definitions live in
`@better-auth/core@1.7.4/dist/db/get-tables.mjs` (fields with `required`, `defaultValue`,
`fieldName`, `references`, `unique`). TS types from the docs are “in typescript format” and map to
database types as you choose (<https://www.better-auth.com/docs/concepts/database> → “Core Schema”).
The standard Drizzle/Postgres mapping generated by the CLI is `string → text`, `date → timestamp`,
`boolean → boolean` (verified against this repo’s generated
`packages/db/drizzle/0000_better_auth_schema.sql`, which was produced by `drizzle-kit generate` from
the Better Auth Drizzle schema).

| Model (default `modelName`) | Field (JS)                                                                                | Required | Default / notes                                    | Default DB column name   |
| --------------------------- | ----------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- | ------------------------ |
| `user`                      | `id`                                                                                      | yes      | PK, generated string (see 2.3)                     | `id`                     |
|                             | `name`                                                                                    | yes      |                                                    | `name`                   |
|                             | `email`                                                                                   | yes      | unique                                             | `email`                  |
|                             | `emailVerified`                                                                           | yes      | `defaultValue: false`, `input: false`              | `emailVerified`          |
|                             | `image`                                                                                   | no       |                                                    | `image`                  |
|                             | `createdAt`                                                                               | yes      | `defaultValue: () => new Date()`                   | `createdAt`              |
|                             | `updatedAt`                                                                               | yes      | `defaultValue`/`onUpdate: new Date()`              | `updatedAt`              |
| `session`                   | `id`                                                                                      | yes      | PK                                                 | `id`                     |
|                             | `expiresAt`                                                                               | yes      |                                                    | `expiresAt`              |
|                             | `token`                                                                                   | yes      | unique                                             | `token`                  |
|                             | `createdAt`                                                                               | yes      | `defaultValue: new Date()`                         | `createdAt`              |
|                             | `updatedAt`                                                                               | yes      | `onUpdate`                                         | `updatedAt`              |
|                             | `ipAddress`                                                                               | no       |                                                    | `ipAddress`              |
|                             | `userAgent`                                                                               | no       |                                                    | `userAgent`              |
|                             | `userId`                                                                                  | yes      | FK → `user.id`, `onDelete: "cascade"`, indexed     | `userId`                 |
| `account`                   | `id`                                                                                      | yes      | PK                                                 | `id`                     |
|                             | `accountId`                                                                               | yes      | stable provider identity / user id for credentials | `accountId`              |
|                             | `providerId`                                                                              | yes      | `credential` for password logins                   | `providerId`             |
|                             | `userId`                                                                                  | yes      | FK → `user.id`, cascade, indexed                   | `userId`                 |
|                             | `password`                                                                                | no       | `returned: false`; hash lives here                 | `password`               |
|                             | `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt` | no       | OAuth only; `returned: false`                      | same names               |
|                             | `scope`                                                                                   | no       | OAuth                                              | `scope`                  |
|                             | `createdAt`, `updatedAt`                                                                  | yes      | defaults as above                                  | `createdAt`, `updatedAt` |
| `verification`              | `id`                                                                                      | yes      | PK                                                 | `id`                     |
|                             | `identifier`                                                                              | yes      | indexed                                            | `identifier`             |
|                             | `value`                                                                                   | yes      |                                                    | `value`                  |
|                             | `expiresAt`                                                                               | yes      |                                                    | `expiresAt`              |
|                             | `createdAt`, `updatedAt`                                                                  | yes      | defaults as above                                  | `createdAt`, `updatedAt` |

Sources: `@better-auth/core@1.7.4/dist/db/get-tables.mjs` (all four definitions, L40–330);
<https://www.better-auth.com/docs/concepts/database> → “Core Schema”, “Custom Tables”;
NextAuth migration guide’s Better Auth `account` field table
(<https://www.better-auth.com/docs/guides/next-auth-migration-guide> → “Account → Account”).
The repo’s `packages/db/src/schema.ts` already uses these exact fields with snake_case DB column
names and works because Drizzle property names match Better Auth’s names.

**Credential accounts specifically:** “Credential accounts use the `credential` provider ID and the
linked user's stable `id` as `accountId`.”
Source: <https://www.better-auth.com/docs/concepts/database> → “Account”.

**Schema validation (1.7.4).** Better Auth validates the configured schema at init and reports
missing/extra columns; disable with `advanced.database.validateSchema: false`.
Source: <https://www.better-auth.com/docs/concepts/database> → “Schema Validation”.

## 2.3 ID generation and constraints

- **Default:** random base62 string, **32 chars** (`a-z`, `A-Z`, `0-9`).
  Docs: “default: random base62 string” in <https://www.better-auth.com/docs/reference/options> →
  `advanced.database.generateId`. Source (1.7.4): `@better-auth/core/dist/utils/id.mjs` —
  `generateId = (size) => createRandomStringGenerator("a-z","A-Z","0-9")(size || 32)`.
- **`generateId` accepts**: a custom function `({ model, size? }) => string | false | undefined`,
  `false` (DB generates for **all** tables), `"serial"` (auto-increment numeric), `"uuid"`.
  Docs: <https://www.better-auth.com/docs/concepts/database> → “ID Generation” (Options 1–3,
  “Numeric IDs”, “UUIDs”, “Mixed ID Types”); <https://www.better-auth.com/docs/reference/options> →
  `advanced.database.generateId`.
- **Returning `false`/`undefined` per model** lets that table’s DB generate the id (e.g. Postgres
  `serial`/`default gen_random_uuid()`), useful for mixed ids when adopting existing integer ids
  (<https://www.better-auth.com/docs/concepts/database> → “Mixed ID Types”).
- **Documented constraints:** Better Auth always treats/infers `id` as a **string**, even for
  `"serial"`, and “all id values passed to Better-Auth (eg via an endpoint body) is expected to be a
  string” (<https://www.better-auth.com/docs/concepts/database> → “Numeric IDs”). With `"uuid"`,
  Postgres may let the DB generate defaults. There is **no documented requirement that the DB must not
  generate ids**; the opposite is documented. Uniqueness is inherent (PK) but not called out as a
  separate constraint in the docs. **UNCONFIRMED:** no documented validation that a custom
  `generateId` result is a string or unique — enforce that yourself.
- When you already have ids (e.g. integer Laravel ids), the Auth0 migration guide uses
  `adapter.create({ model: "account", data: {...}, forceAllowId: true })`
  (<https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/auth0-migration-guide.mdx>
  lines ~346–388).

## 2.4 `user.additionalFields` (and domain columns such as `division_id`)

Exact shape (docs): `FieldAttributes` with `type` (`"string" | "number" | "boolean" | literal array`),
`required`, `defaultValue` (JS-layer only), `input` (default `true`; set `false` for server-owned
fields), `returned` (default `true`; whether stored values appear in responses).
Source: <https://www.better-auth.com/docs/concepts/database> → “Extending Core Schema” (including the
`input`/`returned` semantics table). Same options appear in
<https://www.better-auth.com/docs/reference/options> → `user`.

```ts
user: {
  additionalFields: {
    role: { type: ["user", "admin"], required: false, defaultValue: "user", input: false },
    divisionId: { type: "number", required: false },
  },
}
```

- **In the Drizzle schema:** the CLI’s `generate`/`migrate` commands add/sync these columns (“the CLI
  will automatically update the database schema”,
  <https://www.better-auth.com/docs/concepts/database> → “Extending Core Schema”); with the Drizzle
  adapter you can also add them manually to `schema.ts` — Better Auth maps by Drizzle property name
  (<https://www.better-auth.com/docs/adapters/drizzle> → “Modifying Field Names”).
- **Returned in sessions:** additional fields are “properly inferred in functions like `useSession`,
  `signUp.email`, and other endpoints that work with user or session objects” and are returned unless
  `returned: false` (<https://www.better-auth.com/docs/concepts/database> → “Extending Core Schema”
  and the input/returned table). `session.additionalFields` exists with the same mechanism
  (<https://www.better-auth.com/docs/reference/options> → `session`).
- `databaseHooks.user.create.before` can populate domain fields at insert time, but the docs warn
  type inference for additional fields in hooks “isn't yet supported”
  (<https://www.better-auth.com/docs/concepts/database> → “Database Hooks”).

## 2.5 Documented import path for existing credentials

**Yes — the official migration guides document exactly the “import hashes into `account.password`”
pattern with `providerId: "credential"`:**

- Supabase guide’s migration script inserts legacy users and then, for each email identity, creates:
  ```ts
  { userId: user.id, providerId: 'credential', accountId: user.id,
    password: user.encrypted_password || null, … }
  ```
  (<https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/supabase-migration-guide.mdx>
  lines ~713–726), after configuring bcrypt `hash`/`verify` as in 2.1.
- Auth0 guide’s script maps bcrypt hashes (`$2a$`/`$2b$`) into `password` on `account` rows created
  via `ctx.adapter.create({ model: "account", data: { ..., providerId, accountId, password, ... },
forceAllowId: true })`
  (<https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/auth0-migration-guide.mdx>
  lines ~257–388).
- The `providerId: "credential"` + `accountId = user.id` invariant is stated in
  <https://www.better-auth.com/docs/concepts/database> → “Account”, and sign-in depends on it
  (source 1.7.4: `sign-in.mjs` L316–317).

**Laravel specifically:** there is no Laravel migration guide at the time of research; the bcrypt
pattern above is algorithm-compatible with Laravel’s `Hash::make` bcrypt hashes, but the exact
`$2y$`-prefix handling is **UNCONFIRMED** from primary sources (bcrypt libraries such as `bcryptjs` /
`bcrypt` accept `$2y$` in practice; not documented by Better Auth).

---

# UNCONFIRMED / not found in primary sources

Drizzle:

1. **An official end-to-end “baseline migration” document does not exist.** The closest official
   artifacts are the database-first `pull` docs and the custom-migration docs; the exact recipe of
   “pg_dump as `0000` + a snapshot describing it” is derived from source behaviour, not a doc page.
   The “Migrations for teams” page is a stub as of this research.
2. **`drizzle-kit pull --init`** is documented on the v1 `pull` page but was not found in
   `drizzle-kit/src/cli/commands/introspect.ts` on `main`; not present in v0.31.10.
3. The exact classification of DB defaults as “expression” during `pull` (which yields `sql\`...\``)
was not exercised against a live Postgres; generate-side fidelity for `sql\`uuidv7()\`` was
   verified locally.
4. v1 docs only: folder layout (`2024…_name/migration.sql`) and any v1-specific `--init` semantics.
   This repo is on v0.31.10 and uses the flat layout + `meta/`.

Better Auth:

5. **Rehash-on-login / lazy migration** is neither documented nor present in the 1.7.4 sign-in
   source; there is no official recipe for “verify bcrypt then store scrypt”.
6. **Laravel-specific guidance** (and explicit `$2y$` bcrypt handling) does not exist; only generic
   bcrypt via the Supabase/Clerk/Auth0 guides.
7. No documented guarantee/validation for custom `generateId` return values beyond “IDs are handled
   as strings”; uniqueness is implied by the primary key.
