# ADR-0032: The domain User record survives the identity transform

**Context:** ADR-0024 retained `master.users` in the baseline as a staging table: the identity transform (#7) was to copy its rows into Better Auth's tables, re-point every foreign key, and drop it (D-004). The choice resurfaced during #7's design, with two facts the original plan did not weigh: every domain table holds a foreign key to `master.users` — the ledger's own rationale for keeping it through the build — and the Master CRUD (#6) is built against it, dual-writing the Better Auth identity under the same UUID. The alternatives were to follow the drop plan, to move profile fields onto Better Auth's `user` via `additionalFields`, or to split identity from a profile table.

**Options considered:**

- **Copy rows into Better Auth and drop `master.users`.** Follows the original plan, but re-points every domain's foreign key at the auth vendor's tables: business data would hold Better Auth's keys, so swapping auth becomes a business-data migration.
- **Move profile fields onto Better Auth's `user`.** Fewer tables, same coupling, and Better Auth's user row becomes the owner of soft-delete, division membership and employment data — concerns it has no vocabulary for.
- **Keep `master.users` as the durable business record; Better Auth owns credentials and sessions only.** Chosen.

**Decision:** `master.users` survives. It is the User every domain holds a foreign key to; Better Auth (`user`, `account`, `session`, `verification`) owns credentials, sessions and email verification only, joined 1:1 by the same UUID — the shape #6's store already writes. #7's transform drops the legacy auth columns (`password`, `remember_token`) rather than the table, and `email_verified_at` becomes Better Auth's `emailVerified`. Profile data stays on the business record for now; if it outgrows it, a 1:1 `master.user_profiles` can be added later (#115, BC-002) without re-pointing anything, because the foreign keys reference the User, not its fields.

**Trade-offs:** Two rows per person must stay in sync — the Master store owns both writes, so the dual-write is the permanent design rather than a bridge — and `name`, `email` and `image` are duplicated for session display. In exchange, every business foreign key keeps a database-minted UUID (ADR-0026), soft-delete stays domain behaviour rather than an auth-vendor deletion, and the auth provider becomes swappable without touching business data.
