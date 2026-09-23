# ADR-0024: Legacy-dump baseline with replay migrations

**Context:** VMB replaces a live Laravel + Filament app. The new schema is authored in Drizzle (`packages/db`), but the legacy database holds the real records, and at cutover a production snapshot must land in the new system without a bespoke rewrite. The open question was whether to port the legacy shape and evolve it, or design a clean schema and ETL into it. See `docs/research/legacy-schema-inventory.md` for the legacy schema.

**Options considered:**

- **Clean-room schema + transform ETL.** The ETL mappers are the only path for data and must be maintained as the schema evolves.
- **Faithful Drizzle port with improvements baked in at design time.** Same ETL problem, plus the port is authored twice — once as a visual model, once as generated migrations.
- **Cleaned `pg_dump --schema-only` of the deployed legacy DB as migration `0000`**, with every change after it an ordered Drizzle migration, and cutover = load a cleaned data snapshot then replay the chain.

**Decision:** The third.

- `0001` is the legacy schema verbatim, minus the excluded tables below. (`0000` — Better Auth's `user`/`session`/`account`/`verification` — already exists from #21. The chain was not reset to make the baseline `0000`, because that would invalidate the dev and preview Neon branches it is already applied to.)
- Cutover for the business domains is: fresh Neon database ← cleaned schema + filtered data snapshot → `db:migrate`, replaying the same chain development used.
- **No standing dev branch.** The dev branch this ADR assumed is not provisioned, by decision: development data comes from `db:seed`, and the import pipeline's rehearsal runs against a throwaway branch whose verifier report outlives it (ADR-0028).
- **Identity and RBAC are the exception.** Their legacy tables are excluded, so their data is carried by a transform ETL from the raw snapshot into the Better Auth tables (#7) and the new RBAC design (#8). Those paths are _not_ replay-based. This is why the pipeline is hybrid, by necessity.

Excluded from the baseline (rationale and history in `docs/migration/deviations.md`):

- Laravel runtime: `public.cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `migrations`.
- Laravel auth: `auth.sessions`, `auth.password_reset_tokens`, `auth.two_factors` — Better Auth replaces all three; the 2FA secrets are non-portable.
- Spatie RBAC: `master.roles`, `master.permissions`, `spatie.*` — the _data_ (the role→permission matrix and role assignments) is retained in the raw snapshot and mapped into the new RBAC.
- `master.users` — retained in the baseline as a **staging table** (see below); it is the identity transform's source, not part of the final schema.

Postgres schemas (`master`, `warehouse`, `trucking`, `expense`) are **kept**, so `0001` stays close to the dump and new names stay aligned with the legacy code engineers read for parity.

`master.users` is the one deliberate exception: it stays in the baseline so the foreign keys from every domain remain valid, and the identity transform (#7) later copies its rows — preserving ids, since they are already UUIDs — into Better Auth's tables, re-points the foreign keys, and drops it. This amends D-004 in the deviation ledger.

**Amendment (2026-09-23):** The identity transform deliberately does _not_ copy `master.users` into Better Auth and drop it. The table survives as the durable business user record; Better Auth owns credentials and sessions only, and #7 drops just the legacy auth columns (`password`, `remember_token`). Migrated accounts carry no password — first access is an email-OTP activation — so the raw snapshot's bcrypt hashes never enter Better Auth (ADR-0032, ADR-0033; D-004 and D-010 in the ledger). The hybrid-pipeline framing above still holds; only the transform's destination changes.

**Trade-offs:** The repository carries a baseline no one hand-edited and that no application code is written against, and the pipeline remains hybrid for identity/RBAC. In exchange, every later deviation is an executable, ordered, replayable statement that can be proven against real records — and cutover reuses the exact chain development ran, rather than a second, untested ETL.

**Consequences:**

- Drizzle Kit's snapshot for the baseline is captured by `drizzle-kit pull` against a scratch database with `0001` applied. Hand-dropped SQL files are invisible to `drizzle-kit generate`, and `generate --custom` journals an entry while snapshotting the _previous_ schema, so the next `generate` re-emits every `CREATE TABLE`. The baseline must therefore be established through `pull`, not by dropping a file into the migrations directory (`docs/research/drizzle-baseline-and-better-auth.md`).
- Every intentional difference from legacy is registered in `docs/migration/deviations.md`; mechanical deviations are applied in the port, semantic ones as migrations over loaded data.
- Legacy UUIDs are preserved as they are; the only identity change is the client-route link — see ADR-0026.
- Replay is `pnpm --filter @vmb/db db:migrate` (`packages/db/src/migration/apply.ts`), not `drizzle-kit migrate`: the same journal rows (`hash` is sha256 of the file, `created_at` is the journal's `when`), but each pending migration runs as one transaction and one round trip, because the chain's 975 statements against a remote Neon branch cost minutes when awaited one at a time and seconds when batched. The drizzle-orm migrators stay the oracle the module is tested against (#129).
