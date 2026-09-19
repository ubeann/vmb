# Deviation ledger

Every intentional difference between the new VMB schema and the legacy `vmb-warehouse` schema lives here — what changed, why, and what carries it. `CONTEXT.md` is the glossary; `docs/adr/` holds the decisions; this is the itemized register.

Source of truth for the legacy shape: `docs/research/legacy-schema-inventory.md`.

## Status key

- **decided** — settled; the carrying migration or ticket exists or is scheduled.
- **deferred** — knowingly differs from legacy, but the change lands later (usually a semantic change over loaded data).
- **open** — needs a business or design input before it can be carried.

## D. Decided deviations

| ID    | Deviation                                                                                                                                                  | Rationale                                                                                                                                                                                                                                                          | Carried by                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| D-001 | Laravel runtime tables excluded: `public.cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `migrations`                                         | Runtime state with no business meaning; the new stack uses its own cache/queue/logging.                                                                                                                                                                            | Baseline `0001` (ADR-0024)                              |
| D-002 | Laravel auth tables excluded: `auth.sessions`, `auth.password_reset_tokens`, `auth.two_factors`                                                            | Better Auth replaces sessions and reset tokens; the 2FA secrets are non-portable, so users re-enrol.                                                                                                                                                               | Baseline `0001` (ADR-0024), #7                          |
| D-003 | Spatie RBAC tables excluded: `master.roles`, `master.permissions`, `spatie.model_has_roles`, `spatie.role_has_permissions`, `spatie.model_has_permissions` | The new RBAC layer replaces the mechanism, but the _data_ — the role→permission matrix and role assignments — is business data and must be carried over.                                                                                                           | Transform ETL, blocked on #8                            |
| D-004 | `master.users` is **staging-only**: retained in the baseline, excluded from the final schema                                                               | Business tables across every domain hold FKs to it, and legacy user ids are already UUIDs — so keeping it through the build preserves referential integrity, and the #7 identity transform can copy the ids straight into Better Auth's tables before dropping it. | Baseline `0001` retains it; dropped by the #7 transform |
| D-005 | Postgres schemas kept (`master`, `warehouse`, `trucking`, `expense`)                                                                                       | Keeps `0000` close to the dump and new names aligned with the legacy code read for parity.                                                                                                                                                                         | Baseline `0001` (ADR-0024)                              |
| D-006 | _Withdrawn_ — the legacy UUIDs are preserved, so nothing converts (ADR-0026)                                                                               | The row recorded a conversion that does not happen; kept so the numbering and the history stay readable.                                                                                                                                                           | —                                                       |
| D-007 | `trucking.client_route` loses its surrogate `id`; `(client_id, route_id)` becomes the primary key                                                          | The pair is already unique and nothing references the surrogate, so this removes the schema's only bigint identity and its sequence at no foreign-key cost.                                                                                                        | Migration `0002` (ADR-0026)                             |
| D-008 | Ported uuid primary keys gain `DEFAULT gen_random_uuid()`                                                                                                  | The database mints identity for new rows instead of every caller supplying one; an explicit value still wins.                                                                                                                                                      | Migration `0002` (ADR-0026)                             |

## B. Business capability gaps

Places where the legacy model cannot express what operations need. These are inputs to the identity/RBAC design (#7, #8) and to per-domain improvement tickets — not to the baseline.

| ID     | Gap                                                                                                                                                                                                                                                            | Status | Input to   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| BC-001 | **Users belong to exactly one division** (`master.users.division_id`). Operations need users to belong to multiple divisions.                                                                                                                                  | open   | #8         |
| BC-002 | **No dedicated user profile.** Identity fields and profile fields share one table; once Better Auth owns identity, profile data (photo, contact details, employment data) needs an explicit home — extra fields on the auth user, or a separate profile table. | open   | #7         |
| BC-003 | _(placeholder)_ Further capability gaps to be elicited with the business during per-domain design.                                                                                                                                                             | open   | #6, #9–#16 |

## M. Mechanical register

Schema fixes that do not change meaning: types, constraints, indexes, defaults. Each is one migration and one row here, so a reviewer can go from a difference to the migration that carries it. Applied in the port, over loaded data.

| ID    | Where                        | Deviation                                                                                                | Migration |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| M-001 | `master.divisions`           | `description` widened to `text` — the UI validated 1000 characters into a `varchar(255)`                 | `0003`    |
| M-002 | `master.divisions`           | `code` required; it is the business key the admin already enforced                                       | `0004`    |
| M-003 | `master.users`               | index on `division_id` — a foreign key does not bring one                                                | `0005`    |
| M-004 | `warehouse` (both workflows) | `status` defaults `'pending'` → `'pending_approval'`; `'pending'` was not a value of either vocabulary   | `0006`    |
| M-005 | `warehouse`                  | CHECK constraints: procurement status (9 values), requisition status (4), approval type (3)              | `0007`    |
| M-006 | `warehouse`                  | UNIQUE `approvals(approvable_type, approvable_id, type)` and UNIQUE `procurement_requests(quotation_id)` | `0008`    |
| M-007 | `warehouse` (both workflows) | index on `(status, created_at)` for the list and filter queries                                          | `0009`    |

### Deferred, with the reason

- **`master.users.remember_token`** — dropped once Better Auth's session semantics replace it, which is #7's work rather than a schema fix.
- **Laravel-code findings from the inventory** — the missing `payment_proof_url` / `receipt_proof_url` accessors and the `StockRequisitionStatus` class typo were defects in the legacy application, not the database. There is nothing to migrate; the new code does not inherit them.

### A risk worth knowing about M-002 and M-006

`SET NOT NULL` and `ADD CONSTRAINT ... UNIQUE` validate the rows that are already there. On a snapshot whose data violates them — a Division with no code, two approvals for the same target and level, two requests sharing a quotation — the migration fails and the import reports which statement. That is the pipeline working: the alternative is a constraint that silently does not hold. If a real snapshot trips one, the answer is a data decision recorded here, not a quiet `NOT VALID`.

## S. Semantic register

Changes in meaning or model. Deferred to migrations over loaded data.

**Trucking**

- Replace `invoice_shipments.order_number` string with a real order FK; add an explicit invoice→order/trip relation.
- Normalise DTP/DTA `route_reference` and `changed_routes` (today a JSON override next to a real FK on `trips`).
- Decide whether trip `routes` JSON snapshots stay denormalised or normalise to trip-route-locations.
- Reconcile cancellation semantics and the `orders.code` integer business key.

**Warehouse**

- Model rejection explicitly — `REJECTED` is currently unreachable and no reject action exists.
- Replace denormalised `current_stock` with a stock-movement ledger.
- Split quotation/payment/receipt into event rows; give stock alerts a lifecycle and dedupe.

**Expense**

- Decide class-table inheritance vs collapsing shared evidence columns onto `requests`.
- Decide whether monthly budget spend is materialised or stays a runtime sum.
- Drop the polymorphic approval columns if only expense requests are ever approved.
- Retention and soft-delete policy for financial records.

**Identity / RBAC**

- Export the Spatie role→permission matrix and role assignments before dropping; Filament-Shield's configured role name (`super_admin`) does not match the seeded role (`Super Admin`) — a landmine for the mapper.
- User profile and multi-division membership (BC-001, BC-002).

## Verification of deviations

Parity is proven per import and at cutover by: per-table row counts, checksums over business keys per domain, FK integrity across the preserved legacy UUIDs, and a documented per-domain spot-check list (#18).
