# ADR-0025: UUID primary keys, deterministically derived from legacy ids

**Superseded by [ADR-0026](0026-legacy-uuid-keys-preserved.md)** — the legacy tables' primary keys are already UUIDs; see ADR-0026 for the corrected decision and the smaller change it leaves.

**Context:** Legacy tables use bigint identity primary keys (except `master.users`, already `uuid`). The new system uses UUIDs. Repeatability (#18) requires that re-importing a legacy snapshot does not mint new identities: a refresh must be idempotent, and the identities a development import produces should agree with the ones a cutover import produces.

**Options considered:**

- **Keep legacy bigint PKs.** Zero mapping, but the new system stays permanently coupled to a legacy identity scheme.
- **UUIDv7, bit-packed** (timestamp + discriminator + legacy id). Reversible and time-sortable, but requires PG 18 or the `pg_uuidv7` extension, leaks creation time, and the deterministic derivation is hand-rolled bit manipulation.
- **UUIDv4, random** (`gen_random_uuid()`). Opaque and native everywhere, but each import mints new ids, so refreshes are not idempotent and there is no cross-environment agreement.
- **UUIDv4-shaped, deterministically derived for legacy rows**, with random v4 for new rows.

**Decision:** The fourth.

- Migration `0002` converts every ported table. For each legacy row: `uuid = HMAC-SHA256(secret, legacy_table || ':' || legacy_id)`, truncated to 122 bits, with the version bits set to 4 and the RFC 4122 variant bits set.
- New rows use `gen_random_uuid()` — Drizzle's `uuid().defaultRandom()`. No PG 18 or extension dependency.
- `0002` also creates a single `legacy_id_map(legacy_table, legacy_id, uuid)` table, used to rewrite foreign keys and to support parity verification. There are **no per-table `legacy_id` columns**.
- The map is expected to be dropped after cutover is verified and the legacy app is decommissioned (#17); until then it is the only way to answer "which legacy row is this UUID?".
- The HMAC secret lives in fnox (ADR-0011); it must be stable across dev and cutover runs for the derivation to reproduce.

**Trade-offs:** We chose opacity over sortability — v7's B-tree insert locality is immaterial at this scale, and v4 leaks nothing. We chose determinism over pure randomness _for legacy rows only_, which buys idempotent refreshes and dev/prod agreement at the cost of ids being computable by anyone holding the secret. Dropping per-table legacy-id columns keeps the schema clean, but reverse lookup depends on the map until it is safe to drop.

**Consequences:**

- The import pipeline (#18) can be re-run against a fresher snapshot without orphaning rows or duplicating identity.
- Verification can recompute any legacy row's expected UUID forward, independently of the import.
- Password identity follows the same path: legacy users map into Better Auth with the user table owned by Better Auth (#7), and unverifiable hashes fall back to a forced first-login reset with an emailed code.
