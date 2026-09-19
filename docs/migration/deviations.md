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
| D-006 | All ported tables move to UUID primary keys                                                                                                                | Consistent identity for the new system.                                                                                                                                                                                                                            | Migration `0002` (ADR-0025)                             |
| D-007 | Legacy rows get deterministic UUIDv4-shape ids derived by HMAC; new rows get `gen_random_uuid()`                                                           | Makes refreshes idempotent and dev/cutover imports agree, while staying off the PG18/extension dependency.                                                                                                                                                         | Migration `0002` (ADR-0025)                             |
| D-008 | No per-table `legacy_id` columns; one `legacy_id_map` table instead                                                                                        | Clean schema; the map is one droppable artifact rather than thirty columns.                                                                                                                                                                                        | `0002`; dropped post-#17 (ADR-0025)                     |

## B. Business capability gaps

Places where the legacy model cannot express what operations need. These are inputs to the identity/RBAC design (#7, #8) and to per-domain improvement tickets — not to the baseline.

| ID     | Gap                                                                                                                                                                                                                                                            | Status | Input to   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| BC-001 | **Users belong to exactly one division** (`master.users.division_id`). Operations need users to belong to multiple divisions.                                                                                                                                  | open   | #8         |
| BC-002 | **No dedicated user profile.** Identity fields and profile fields share one table; once Better Auth owns identity, profile data (photo, contact details, employment data) needs an explicit home — extra fields on the auth user, or a separate profile table. | open   | #7         |
| BC-003 | _(placeholder)_ Further capability gaps to be elicited with the business during per-domain design.                                                                                                                                                             | open   | #6, #9–#16 |

## M. Mechanical register

Schema fixes that do not change meaning. Applied as migrations in the port; each will be mapped to a migration number as it lands.

**Master / identity**

- `master.divisions`: widen `description`; make `code` NOT NULL if effectively required.
- `master.users`: FK and index on `division_id`; drop `remember_token` once Better Auth session semantics replace it.

**Warehouse**

- Fix `status` defaults that contradict the PHP enums (invalid values throw on hydration).
- Add CHECK constraints for status/type values; add the missing unique constraints (`approvals(approvable_type, approvable_id, type)`, `procurement_requests.quotation_id`).
- Index status/created_at; fix the missing `payment_proof_url` / `receipt_proof_url` accessors; fix the nonexistent `StockRequisitionStatus` class reference.

**Trucking**

- Fix `orders.client_id` FK (NOT NULL with `ON DELETE SET NULL` is impossible).
- Add missing uniques: `route_locations(route_id, position)`, DTP/DTA `(trip_id, plan_code)`, `invoice_shipments(invoice_id)`, `locations(code)`.
- Drop duplicate btree indexes; purge phantom `$fillable` entries (`bill_id`, `route_reference`, trip fee/allowance columns).
- Align money types (`routes` numeric vs plans/actuals integer; a cast truncates cents).
- Fix `invoices.status` default (`'draft'` is not an `InvoiceStatus` value) and the Filament filter's third vocabulary.

**Expense**

- Add uniques (`budgets.division_id`, `*_details.request_id`); index all FKs.
- Fix `requests.status` default (`'pending'` cannot hydrate the uppercase enum) and the erroneous `down()` in the emergency-details migration.
- Add CHECK constraints for `type` / `status` / `category`; the emergency `category` is a varchar holding an int enum's digits.

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

Parity is proven per import and at cutover by: per-table row counts, checksums over business keys per domain, FK integrity across the converted UUIDs, and a documented per-domain spot-check list (#18).
