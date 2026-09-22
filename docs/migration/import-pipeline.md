# Import pipeline

Puts real legacy records into a database so cutover is a replay rather than a second, untested ETL (ADR-0024). There is no standing dev branch (ADR-0028): day-to-day development data comes from `db:seed`, and this pipeline's rehearsal target is a throwaway Neon branch created for the run and deleted after — the verifier report is what outlives it. The code lives in `packages/db/src/import`; the harness in `packages/db/test` runs the same pipeline and the same assertions against embedded Postgres by default, or against a real one when `TEST_DATABASE_URL` is set.

## The order that matters

```
baseline (0000–0001)  →  load the snapshot  →  everything after the baseline
```

The baseline must exist before rows arrive, and every later migration must run **over the loaded rows** — otherwise a conversion like the `timestamptz` change (#114) would never see the data. The pipeline splits the chain at `0001_legacy_baseline` and journals each migration as it completes, so a database it produces is indistinguishable from one the migrator built and a later `db:migrate` applies only what is missing.

`db:migrate` is `packages/db/src/migration/apply.ts`, not `drizzle-kit migrate`: it writes the same journal rows (`hash` is sha256 of the file, `created_at` is the journal's `when`) but replays each pending migration as one round trip — its statements, its transaction and its journal insert in a single `exec`. Replaying the chain's 975 statements one at a time against a remote database is minutes of latency; per file it is seconds. The drizzle-orm migrators the tests use stay the independent oracle it is checked against (`packages/db/test/migrate.test.ts`).

Rows are inserted parents-first, in the order in `src/import/schema-order.ts`, derived from the baseline's foreign-key graph and checked by a test against the live schema. `trucking.orders.reference_id` is the one self-reference: its key is immediate, so rows _within_ that table are ordered by their references before insertion, and a cycle is reported rather than silently mis-loaded.

## Running it

Produce a data snapshot from the legacy database:

```sh
pg_dump --data-only --no-owner --no-privileges "$LEGACY_DATABASE_URL" > snapshot.sql
```

Dry run — throwaway in-memory database, nothing to clean up:

```sh
pnpm --filter @vmb/db db:import --snapshot snapshot.sql
```

Against a Neon branch — the rehearsal's throwaway one, or the cutover target — pass its connection string:

```sh
pnpm --filter @vmb/db db:import --snapshot snapshot.sql --url "$DATABASE_URL"
```

`--database <dir>` keeps an embedded database on disk instead, which is useful for poking at the result without a server.

Exit code 0 means the report carried no findings at all — no errors **and** no warnings; 1 means it carried some, and they are printed.

**The pipeline owns the database it is pointed at.** It drops the four legacy schemas, the migration journal and the auth tables before loading, and leaves everything else alone. Refreshing from a newer snapshot is the same command again, and running it twice lands in the same place — there is no partial update.

## What is carried, and what is not

Carried: the 30 ported tables under `master` (including `users`), `warehouse`, `trucking` and `expense`. `master.users` travels because every domain holds foreign keys to it (ledger D-004) and the identity transform (#7) needs it.

Left behind, with the reason recorded in `src/import/manifest.ts`:

| Left behind                                                                       | Why                                                                                                                          |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `public.cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `migrations` | Laravel runtime                                                                                                              |
| `auth.sessions`, `auth.password_reset_tokens`, `auth.two_factors`                 | replaced by Better Auth (#7)                                                                                                 |
| `master.roles`, `master.permissions`, `spatie.*`                                  | replaced by the RBAC layer (#8) — **data is retained in the raw snapshot** so the mapper can be written without another dump |

The snapshot must still contain the excluded tables; the pipeline ignores their rows and reports nothing about them. Keeping them in the dump is what makes the RBAC transform possible later.

## The report

The report is the product. It carries per-table row counts, a checksum per table over the business keys that exist, an FK-integrity count, and two lists — `errors` and `warnings`. The operator signal is `errors: 0, warnings: 0`.

| Finding         | Level   | Meaning                                                            |
| --------------- | ------- | ------------------------------------------------------------------ |
| `row-count`     | error   | the database holds a different number of rows than the snapshot    |
| `checksum`      | error   | a table's business keys differ from the snapshot's                 |
| `fk-integrity`  | error   | a row names a parent that does not exist                           |
| `row-shape`     | error   | a snapshot row has the wrong number of values for its column list  |
| `business-key`  | error   | a configured business key names a column the snapshot lacks        |
| `instant`       | error   | a timestamp is not the instant its wall-clock named                |
| `unknown-table` | warning | the snapshot holds a table the manifest neither ports nor excludes |
| `pipeline`      | error   | the run failed before verification (a statement was rejected, say) |

The checksum is computed over the business keys listed in `src/import/verify.ts` — from the snapshot's rows and from the database's, by the same code, so it compares data rather than two spellings of one query. Row order is not part of what it proves.

The instant check exists because the snapshot holds Jakarta wall-clock while the database holds absolute instants after `0022`: comparing the two as text would report a seven-hour drift on every row, so both sides are reduced to epoch milliseconds before they are compared.

The foreign-key check counts **rows**, not constraints: the constraints are enforced on the way in, so an orphan only appears if a load bypassed enforcement or a later migration moved children without their parents. `unknown-table` is schema drift — a new legacy table nobody has classified — and is a warning rather than an error because it is a question, not a fault.

A malformed row is reported rather than thrown, so one bad row does not hide the rest of the report. Nothing in the pipeline silently repairs data: a row that cannot load is a finding, and the row count and the checksum for its table will disagree too.

## Spot checks per domain

Automated checks prove the data arrived and survived the chain. These are the manual checks worth a human's eye at cutover, once, per domain:

- **Master** — every Division's `code` matches what the legacy admin shows; the count of active Users is unchanged.
- **Trucking** — the newest Order's `code`, `status` and `client` agree with the legacy app; an Invoice's billed amount equals what was billed before cutover; a Trip's route still resolves.
- **Warehouse** — an Item's `current_stock` equals the legacy figure; a Procurement Request's status matches the legacy workflow stage.
- **Expense** — a Budget's `amount` is unchanged; a Request's niche/emergency variant and amount agree with legacy.

These are deliberately not automated: they compare against the legacy _application_, which is the one reference the database cannot supply.

## Testing

The database suite runs on embedded Postgres by default, so it needs no service and no secrets:

```sh
pnpm test
```

To run the same fixtures and assertions against a real server — which is what the `Real Postgres` CI job does — point the harness at one:

```sh
TEST_DATABASE_URL=postgres://user@localhost:5432/postgres pnpm --filter @vmb/db test
```

A database is created and dropped around each test — or around a block that deliberately shares state, such as the re-run test — so the suite stays parallel-safe and leaves nothing behind. Running both is the point: embedded Postgres is a re-implementation, and the one thing it cannot prove is that Postgres agrees with it, while the migrations actually run against Neon.

## Known limits

- **`COPY` format only.** Only `pg_dump --data-only` output is understood; `--inserts` is not. `COPY FROM stdin` is unavailable on every target the pipeline runs against, so the loader emits `INSERT` statements.
- **The target is reset, not merged.** There is no upsert path, and nothing outside the schemas the pipeline owns survives a run.
- **Identity and RBAC are out of scope.** Their transform needs #7 and #8; until then their rows stay in the snapshot.
