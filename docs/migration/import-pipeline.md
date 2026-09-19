# Import pipeline

Puts real legacy records into a Neon branch so development and parity checks run against actual data, and so cutover is a replay rather than a second, untested ETL (ADR-0024). The code lives in `packages/db/src/import`; the harness in `packages/db/test/import.test.ts` runs the same pipeline against embedded Postgres.

## The order that matters

```
baseline (0000–0001)  →  load the snapshot  →  everything after the baseline
```

The baseline must exist before rows arrive, and every later migration must run **over the loaded rows** — otherwise a conversion like the `timestamptz` change (#114) would never see the data. The pipeline splits the chain at `0001_legacy_baseline` and journals each migration as it completes, so a database it produces is indistinguishable from one the migrator built and a later `drizzle-kit migrate` applies only what is missing.

Rows are inserted parents-first, using the order generated from the baseline's foreign-key graph (`src/import/schema-order.ts`). `trucking.orders.reference_id` is the one self-reference; it is nullable, so a row may name a row that is inserted after it in the same table.

## Running it

Produce a data snapshot from the legacy database:

```sh
pg_dump --data-only --no-owner --no-privileges "$LEGACY_DATABASE_URL" > snapshot.sql
```

Dry run — throwaway in-memory database, nothing to clean up:

```sh
pnpm --filter @vmb/db db:import --snapshot snapshot.sql
```

Against a Neon branch (or any Postgres the pipeline can reach), keep the data with `--database`:

```sh
pnpm --filter @vmb/db db:import --snapshot snapshot.sql --database ./.import-data
```

Exit code 0 means the report was clean; 1 means it was not, and the findings are printed.

Refreshing from a newer snapshot is the same command again: the pipeline is wipe-and-reload, and the database it targets is expected to be empty. Reproducing a branch from scratch is the refresh path — there is no partial update.

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

| Finding        | Level | Meaning                                                            |
| -------------- | ----- | ------------------------------------------------------------------ |
| `row-count`    | error | the database holds a different number of rows than the snapshot    |
| `row-shape`    | error | a snapshot row has the wrong number of values for its column list  |
| `no-columns`   | error | the snapshot has rows for a table but no column list               |
| `fk-integrity` | error | a foreign key points at a row that does not exist                  |
| `pipeline`     | error | the run failed before verification (a statement was rejected, say) |

A malformed row is reported rather than thrown, so one bad row does not hide the rest of the report. Nothing in the pipeline silently repairs data: a row that cannot load is a finding, and the row count for its table will disagree too.

## Spot checks per domain

Automated checks prove the data arrived and survived the chain. These are the manual checks worth a human's eye at cutover, once, per domain:

- **Master** — every Division's `code` matches what the legacy admin shows; the count of active Users is unchanged.
- **Trucking** — the newest Order's `code`, `status` and `client` agree with the legacy app; an Invoice's billed amount equals what was billed before cutover; a Trip's route still resolves.
- **Warehouse** — an Item's `current_stock` equals the legacy figure; a Procurement Request's status matches the legacy workflow stage.
- **Expense** — a Budget's `amount` is unchanged; a Request's niche/emergency variant and amount agree with legacy.

These are deliberately not automated: they compare against the legacy _application_, which is the one reference the database cannot supply.

## Known limits

- **`COPY` format only.** Only `pg_dump --data-only` output is understood; `--inserts` is not. `COPY FROM stdin` is unavailable on every target the pipeline runs against, so the loader emits `INSERT` statements.
- **Empty target only.** There is no merge or upsert path; wipe-and-reload is the contract.
- **Identity and RBAC are out of scope.** Their transform needs #7 and #8; until then their rows stay in the snapshot.
