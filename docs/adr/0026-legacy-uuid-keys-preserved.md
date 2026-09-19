# ADR-0026: Legacy UUID primary keys are preserved; only the client-route link changes

**Context:** ADR-0025 assumed the legacy tables used bigint identity primary keys, and specified a deterministic HMAC derivation plus a `legacy_id_map` table to re-mint them as UUIDs. Inspecting the production schema shows **29 of the 30 ported tables already use `uuid` primary keys**. `trucking.client_route` is the only `bigint` identity in the entire schema, and nothing references it.

**Options considered:**

- Keep ADR-0025's derivation: mint new UUIDs for every ported row and rewrite every foreign key. Large, lossy (it discards the ids the legacy system actually used), and it needs an HMAC secret available at migration time.
- Preserve the legacy UUIDs, and keep a converted surrogate uuid on the client-route link.
- Preserve the legacy UUIDs, and drop the link's surrogate entirely.

**Decision:** Preserve the legacy UUIDs.

- No conversion, no map table, no derivation, no HMAC secret.
- `trucking.client_route` loses its surrogate `id` and its sequence; `(client_id, route_id)` — already unique — becomes the primary key. Nothing referenced the surrogate, so no foreign key changes.
- The 29 uuid primary keys gain `DEFAULT gen_random_uuid()`, so the database mints identity for new rows.

**Trade-offs:** We give up a deterministic derivation that could reproduce the same ids from a fresh snapshot — unnecessary, because the ids are _stored values_ carried in the snapshot, which makes development and cutover agree by construction and makes re-imports idempotent for free. The client-route link's composite key is a deviation from legacy, as are the database defaults (Laravel always supplied ids); both are recorded in the ledger.

**Consequences:** Supersedes ADR-0025. Withdraws ledger row D-006, which no longer records a difference; D-007 and D-008 record the two changes. #104 shrinks to those two changes.
