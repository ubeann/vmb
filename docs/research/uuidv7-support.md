# UUIDv7 support research: Neon, PostgreSQL, Drizzle, Better Auth

Research date: **2026-09-19** (all pages/sources accessed on this date).
Stack baseline verified from this repo: `drizzle-orm@^0.45.2`, `drizzle-kit@^0.31.10`, `better-auth@^1.7.4` (see `packages/db/package.json`, `apps/web/package.json`, `apps/api/package.json`).

Legend: **UNCONFIRMED** = could not be verified from a primary source; not guessed. Every other statement has a citation directly below it.

---

## 1. Neon + Postgres version support

**Claim:** Neon currently supports Postgres majors 14, 15, 16, 17 and 18. Postgres 18 is a selectable, supported major version (not documented as beta anywhere on the pages checked).

- Neon compatibility page: "Neon supports Postgres 14, 15, 16, 17, and 18. You select the Postgres version you want to use when creating a Neon project."
  - https://neon.com/docs/reference/compatibility (section "Postgres versions")
- Neon version support page: "Neon currently supports Postgres 14, 15, 16, 17, and 18." As of August 2026 the latest minors on Neon are 18.6, 17.11, 16.15, 15.19, 14.24; PG 18.1–18.6 rollouts are listed (first availability 2025-12-03 for 18.1, through 2026-08-18 for 18.6).
  - https://neon.com/docs/postgresql/postgres-version-support (sections "Supported major versions", "Recent minor version rollouts")
- Major-version upgrades require creating a new Neon project and migrating data (no in-place major upgrade).
  - https://neon.com/docs/postgresql/postgres-version-support (section "Major version upgrades")

**UNCONFIRMED:** An explicit "Postgres 18 is generally available" wording. The docs treat 18 as fully supported (it appears in the support list and in the minor-release rollout table), but no page checked uses the literal term "GA". Treat "supported/selectable" as confirmed, the "GA" label as not confirmed.

---

## 2. Native `uuidv7()` in PostgreSQL 18

**Claim (added in PG 18):** PostgreSQL 18 added a native `uuidv7()`.

- Release notes: "Add UUID version 7 generation function `uuidv7()` (Andrey Borodin) … This UUID value is temporally sortable. Function alias `uuidv4()` has been added…"
  - https://www.postgresql.org/docs/18/release-18.html
- Commit: `78c5e141e` "Add UUID version 7 generation function." (author Andrey Borodin). Commit message states UUIDv7 "combines a Unix timestamp in milliseconds and random bits, offering both uniqueness and sortability", and that the 12-bit sub-millisecond fraction lives in `rand_a` and "also function[s] as a counter", guaranteeing monotonicity within a backend even if the clock goes backwards.
  - https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=78c5e141e (also `https://github.com/postgres/postgres/commit/78c5e141e`)

**Signature (PG 18.6 docs):**

- `uuidv7 ( [ shift interval ] ) → uuid` — "Generates a version 7 (time-ordered) UUID. The timestamp is computed using UNIX timestamp with millisecond precision + sub-millisecond timestamp + random. The optional parameter shift will shift the computed timestamp by the given interval. Infinite interval values are not accepted." Errors if the shifted timestamp is outside UUIDv7's 48-bit ms range (1970-01-01 to ~year 10889).
  - https://www.postgresql.org/docs/18/functions-uuid.html (Table 9.45)

**Bit layout returned (implementation):**

- `generate_uuidv7()` in `src/backend/utils/adt/uuid.c` (REL_18_STABLE) fills the 48-bit `unix_ts_ms` big-endian in bytes 0–5, then uses the 12 `rand_a` bits (octets 6–7) for a 1/4096 sub-millisecond fraction ("Method 3" from RFC 9562), then fills the remaining random bits. On platforms with only microsecond clocks (macOS, MSVC) the 2 least-significant bits are XORed with CSPRNG bits. Version (`0111`) and variant (`10`) bits are set last.
  - https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/utils/adt/uuid.c (comments at lines 53–74, `generate_uuidv7` at lines 621–670; comment line 608: "48 bits and 74 random bits, excluding the required version and variant bits")
- Layout is RFC 9562 §5.7: bits 0–47 `unix_ts_ms`, 48–51 version, 52–63 `rand_a`, 64–65 variant, 66–127 `rand_b`.
  - https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7 (RFC 9562, May 2024)

**Volatility:** **VOLATILE**. Both overloads are registered with `provolatile => 'v'`.

- `src/include/catalog/pg_proc.dat` (REL_18_STABLE), lines 9492–9499: `proname => 'uuidv7', provolatile => 'v'` for both `uuidv7()` and `uuidv7(interval)` (arg name `shift`).
  - https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/catalog/pg_proc.dat

Consequences of VOLATILE: safe as a column `DEFAULT` (evaluated per row); not usable in index expressions or generated columns.

**Related extraction functions (PG 18 docs):** `uuid_extract_timestamp(uuid)` (works for v1 and v7), `uuid_extract_version(uuid)`.

- https://www.postgresql.org/docs/18/functions-uuid.html (Table 9.46)

---

## 3. Extensions on Neon (`pg_uuidv7`, `gen_random_uuid`, UUIDv7 docs)

**Claim:** `pg_uuidv7` is available on Neon for PG14–PG18 at version 1.6. The extension list explicitly notes PG18's built-in function.

- Extension table row: `pg_uuidv7`, columns PG14=1.6, PG15=1.6, PG16=1.6, PG17=1.6, PG18=1.6, note: "PostgreSQL 18 and later include the built-in `uuidv7()` function. If you only need to generate UUIDv7 values on Postgres 18+, you don't need this extension."
  - https://neon.com/docs/extensions/pg-extensions
- Enable with `CREATE EXTENSION IF NOT EXISTS pg_uuidv7;`. Functions: `uuid_generate_v7()`, `uuid_v7_to_timestamptz(uuid)`, `uuid_timestamptz_to_v7(ts timestamptz, zero_random_bits boolean default false)` (the last zeroes random bits to create deterministic time-range boundary UUIDs).
  - https://neon.com/docs/extensions/pg_uuidv7

**Claim:** `gen_random_uuid()` (UUIDv4) is available without any extension on all Neon-supported majors. It is a core function in PostgreSQL; the PG14 docs (oldest Neon major) list it.

- https://www.postgresql.org/docs/14/functions-uuid.html (Table: `gen_random_uuid () → uuid`)
- Also listed in PG18 core: https://www.postgresql.org/docs/18/functions-uuid.html (PG18 adds the alias `uuidv4()`).

**Neon UUIDv7-specific documentation:** yes — the `pg_uuidv7` page and extension list are Neon's UUIDv7 documentation, including the PG18 native-function note and B-tree/index-locality narrative. No separate Neon function reference for a native `uuidv7()` was checked beyond these pages. **UNCONFIRMED:** whether Neon's SQL-editor function docs additionally document `uuidv7()` outside the extension page.

---

## 4. Drizzle ORM (pinned `drizzle-orm@^0.45.2`, `drizzle-kit@^0.31.10`)

**Declaring a uuid column:**

```ts
import { sql } from "drizzle-orm";
import { uuid, pgTable } from "drizzle-orm/pg-core";

export const t = pgTable("t", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  // v4 DB default:
  id4: uuid().defaultRandom(),
  // client-side/runtime default:
  idRuntime: uuid().$defaultFn(() => crypto.randomUUID())
});
```

- Docs: `uuid()` maps to PostgreSQL `uuid`; example shows `uuid().defaultRandom()` → `DEFAULT gen_random_uuid()` and `uuid().default(sql\`gen_random_uuid()\`)` → same DDL.
  - https://orm.drizzle.team/docs/column-types/pg#uuid and #default-value
- `defaultRandom()` emits exactly `DEFAULT gen_random_uuid()` — verified in the published package, not just docs: `drizzle-orm@0.45.2`, `pg-core/columns/uuid.js`: `return this.default(sql\`gen_random_uuid()\`);`
  - Published npm tarball `drizzle-orm@0.45.2` (`npm pack drizzle-orm@0.45.2`; file `package/pg-core/columns/uuid.js`), accessed 2026-09-19
- Custom SQL default via `.default(sql\`uuidv7()\`)` is the documented mechanism and passes SQL through to DDL (`DEFAULT uuidv7()`). Same mechanism shown for `gen_random_uuid()` in the docs.
  - https://orm.drizzle.team/docs/column-types/pg#default-value

**`$defaultFn` generates client-side:** yes, at runtime in `drizzle-orm`, and the docs explicitly state it does not affect `drizzle-kit` (no DDL emitted):

> "When using `$default()` or `$defaultFn()`, which are simply different aliases for the same function, you can generate defaults at runtime and use these values in all insert queries. … Note: This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`"

- https://orm.drizzle.team/docs/column-types/pg#default-value

So Drizzle's documented split is: `.default(...)`/`.defaultRandom()` = schema-level (emitted by drizzle-kit, DB-side); `$defaultFn(...)` = ORM-runtime only (not in migrations). No primary source was found that recommends one over the other in general terms; **UNCONFIRMED** as an "opinion", but the behavioral difference above is confirmed.

**Built-in uuidv7 helper:** **No.** Case-insensitive grep for `uuidv7`/`uuid7` across the shipped JS/TS declaration files of:

- `drizzle-orm@0.45.2` (the version this repo pins) → zero matches
- `drizzle-orm@1.0.0-rc.4` (current `rc` dist-tag at access) → zero matches; its `pg-core/columns/uuid.d.ts` still exposes only `defaultRandom()` → `gen_random_uuid()`

Both obtained via `npm pack` from the npm registry on 2026-09-19. **UNCONFIRMED:** whether a uuidv7 helper is planned in a future Drizzle release (no public statement found; not guessed).

---

## 5. Better Auth ID constraint (pinned `better-auth@^1.7.4`)

**Claim:** the default `id` is a 32-character random base62 string, and `advanced.database.generateId` accepts a custom function that may return any string, including a UUIDv7 string.

- Default generator source (tag `v1.7.4`), `packages/core/src/utils/id.ts`:

  ```ts
  import { createRandomStringGenerator } from "@better-auth/utils/random";
  export const generateId = (size?: number) => {
    return createRandomStringGenerator("a-z", "A-Z", "0-9")(size || 32);
  };
  ```

  https://github.com/better-auth/better-auth/blob/v1.7.4/packages/core/src/utils/id.ts

- Options reference: `generateId: ((options: { model: string; size?: number }) => string) | false | "serial" | "uuid"`; default documented as "random base62 string".
  - https://www.better-auth.com/docs/reference/options#advanced-database
- Concepts/database: "Use a function to generate IDs"; example `generateId: () => crypto.randomUUID()`. Returning `false`/`undefined` for a model lets the database generate that model's ID. `generateId: "uuid"` makes the CLI generate/migrate `id` as a UUID type; "except adapters that use PostgreSQL where we allow the database to generate the UUID automatically".
  - https://www.better-auth.com/docs/concepts/database#id-generation (sections "Option 2: Custom ID Generation Function", "UUIDs", "Numeric IDs")

**So:** returning a UUIDv7 string from `advanced.database.generateId` is allowed by the documented contract (`=> string`).

**DB-side generation with the Drizzle adapter is reliable on Postgres:** the v1.7.4 Drizzle adapter executes `insert(...).values(...)` and then `.returning()` whenever `provider !== "mysql"` (`withReturning()`, lines 226–235; `create()` at lines 781–788). A column `DEFAULT uuidv7()` therefore round-trips. The adapter's "best-effort fallback / unreliable with `generateId: false`" warning is MySQL-only (lines 197–209).

- https://github.com/better-auth/better-auth/blob/v1.7.4/packages/drizzle-adapter/src/drizzle-adapter.ts

**UNCONFIRMED:** behavior/compat of `generateId: "uuid"` with a custom Drizzle schema whose `id` is `uuid` vs `text` — the docs describe CLI-generated schemas, not imported hand-written Drizzle schemas; not tested here.

---

## 6. Deterministic UUIDv7 derivation for legacy bigint PKs

### Layout and bit budget (authoritative)

RFC 9562 §5.7 / Figure 11:

| Bits   | Field        | Content                                    |
| ------ | ------------ | ------------------------------------------ |
| 0–47   | `unix_ts_ms` | 48-bit big-endian Unix ms                  |
| 48–51  | `ver`        | 4 bits, must be `0111`                     |
| 52–63  | `rand_a`     | 12 bits (random and/or structured/counter) |
| 64–65  | `var`        | 2 bits, must be `10`                       |
| 66–127 | `rand_b`     | 62 bits (random and/or structured/counter) |

Free/steerable bits = 12 + 62 = **74 bits**. The RFC explicitly permits using these bits as a combination of subfields (sub-ms fraction, counter, random) in most-significant-first order.

- https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7 (and §6.2 for monotonicity methods)
- PostgreSQL's own implementation demonstrates the bit manipulation: `src/backend/utils/adt/uuid.c`, `generate_uuidv7()` (REL_18_STABLE).
  - https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/utils/adt/uuid.c (lines 621–670)
- The `pg_uuidv7` extension shows the same version/variant bit operations in C (`uuid->data[6] = (uuid->data[6] & 0x0f) | 0x70`, `uuid->data[8] = (uuid->data[8] & 0x3f) | 0x80`).
  - https://github.com/fboulnois/pg_uuidv7/blob/main/pg_uuidv7.c (lines 42–49, 99–107)

### Proposed scheme: "legacy namespace" UUIDv7

Encode `(timestamp, table_discriminator, legacy_id)` deterministically:

- `unix_ts_ms` (48 bits): fixed shared constant (recommended: `0`, or a project-wide `LEGACY_EPOCH_MS` such as `2025-01-01T00:00:00Z`) **or** the row's true `created_at` converted to Unix ms — only if that value is byte-identical in every environment (same instant, same precision, same timezone handling). A fixed constant is the safer choice for cross-environment idempotence; keep the true `created_at` in its own column.
- `rand_a` (12 bits): **table discriminator**, unique per table, range 0–4095.
- `rand_b` (62 bits): **legacy bigint id**.
- Version/variant bits forced to `0111` / `10`.

**Bit budget / maximum id:** 62 bits → max legacy id per table = `2^62 − 1 = 4,611,686,018,427,387,903` (~4.6×10^18). Every non-negative PostgreSQL `bigint` id (max `2^63−1 = 9,223,372,036,854,775,807`) fits; the constraint applies per table, not globally. Negative ids must be offset or rejected (the mapping below assumes `0 ≤ id ≤ 2^62−1`). If more than 4096 tables are needed, resize the split (e.g., 8-bit discriminator + 66-bit id), but keep it fixed project-wide.

### Reference SQL implementation (pure SQL, works on Neon PG14+; no C extension needed)

```sql
CREATE OR REPLACE FUNCTION legacy_v7(
  p_ts_ms  bigint,    -- fixed LEGACY_EPOCH_MS, or created_at in Unix ms
  p_table  smallint,  -- table discriminator, 0..4095
  p_legacy bigint     -- legacy id, 0..2^62-1
) RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT (
      lpad(to_hex(p_ts_ms), 12, '0')                                -- 48-bit unix_ts_ms
   || '7'                                                           -- version 0111
   || lpad(to_hex(p_table::bigint & 4095), 3, '0')                  -- 12-bit rand_a
   || to_hex(8 | ((p_legacy >> 60) & 3))                            -- variant 10 + top 2 id bits
   || lpad(to_hex(p_legacy & ((1::bigint << 60) - 1)), 15, '0')     -- low 60 id bits
  )::uuid
$$;

-- Example: SELECT legacy_v7(0, 1, 1); -> 00000000-0000-7001-8000-000000000001
```

### Why it is collision-safe

- Within a table, legacy ids are unique by definition → distinct `rand_b` (same `unix_ts_ms` and discriminator).
- Across tables, discriminators differ (enforced unique in a table-discriminator registry) → distinct `rand_a`.
- Across the fixed-epoch legacy set vs runtime-generated UUIDv7s: legacy rows carry an old/fixed `unix_ts_ms`; runtime `uuidv7()` values carry "now" (or `now( ) + shift`), so the two sets occupy disjoint timestamp prefixes. If per-row `created_at` is used, any legacy-vs-runtime collision additionally requires the 74 structured bits to match a random 74-bit value (negligible); this is not needed with a fixed epoch.
- Idempotence: re-running the import computes the exact same UUID for the same `(ts, table, legacy_id)`; a `PRIMARY KEY`/`ON CONFLICT DO NOTHING` upsert is safe.

### Caveats (must be accepted explicitly)

- **Guessability:** the mapping is deterministic and ordered; sequential legacy ids are visible. If public enumeration matters, replace `rand_b = legacy_id` with `rand_b = (HMAC(PerTableKey, legacy_id) & (2^62−1))`, accepting a 62-bit collision probability per table instead of the guaranteed uniqueness above.
- **Timestamp introspection lies:** `uuid_extract_timestamp()` / `uuid_v7_to_timestamptz()` on a fixed-epoch legacy UUID returns the fixed epoch, not the true creation time. Keep the real `created_at`.
- **RFC posture:** version/variant are valid UUIDv7; structured `rand_a`/`rand_b` is explicitly allowed (§5.7). The trade-off is reduced unguessability (§6.9), which is the point of a deterministic mapping.
- **No native function does this:** PostgreSQL 18's `uuidv7(interval)` only shifts _now_, and `pg_uuidv7`'s `uuid_timestamptz_to_v7(ts, zero_random_bits)` yields a fully fixed UUID (zeroed random bits) with no room for table/id encoding. The deterministic per-row mapping must be hand-rolled (SQL above, or the equivalent in the import script).

---

## 7. Index/locality claims

The mechanism claim (UUIDv7 is time-ordered → better B-tree insert locality than UUIDv4) is **confirmed** by primary sources; the magnitude of the improvement is **UNCONFIRMED** (no controlled benchmark found in a primary source).

- RFC 9562 §2.1: non-time-ordered UUIDs such as v4 "have poor database-index locality … they require inserts to be performed at random locations. The resulting negative performance effects on the common structures used for this (B-tree and its variants) can be dramatic." §5.6: UUIDv6 is "reordered for improved DB locality"; §5.7: "Implementations SHOULD utilize UUIDv7 instead of UUIDv1 and UUIDv6 if possible."
  - https://www.rfc-editor.org/rfc/rfc9562.html#section-2.1 and #section-5.7
- PostgreSQL 18 release notes: "`uuidv7()` function for generating timestamp-ordered UUIDs"; and "This UUID value is temporally sortable."
  - https://www.postgresql.org/docs/18/release-18.html
- PostgreSQL commit `78c5e141e`: UUIDv7 "combines a Unix timestamp in milliseconds and random bits, offering both uniqueness and sortability" and is monotonic within a backend.
  - https://git.postgresql.org/gitweb/?p=postgresql.git;a=commit;h=78c5e141e
- Neon's `pg_uuidv7` docs: "Because UUIDv7s are time-ordered, new entries are typically inserted towards the end of an index … better data locality, reduced page splits, and less index fragmentation compared to random UUIDs (like v4)."
  - https://neon.com/docs/extensions/pg_uuidv7 (section "Key advantages of UUIDv7")

**UNCONFIRMED:** a primary-source benchmark quantifying the improvement (e.g., page splits/sec, insert throughput ratios).

---

## What we can rely on today

| Capability                                                           | Supported?                                                                   | Source                                                                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Neon runs PG 14–18; PG 18 selectable                                 | Yes                                                                          | https://neon.com/docs/reference/compatibility ; https://neon.com/docs/postgresql/postgres-version-support                               |
| Native `uuidv7()` (PG18): `uuidv7([shift interval])`                 | Yes, VOLATILE                                                                | https://www.postgresql.org/docs/18/functions-uuid.html ; pg_proc.dat REL_18_STABLE (`provolatile => 'v'`)                               |
| `pg_uuidv7` extension on Neon (PG14–18, v1.6)                        | Yes                                                                          | https://neon.com/docs/extensions/pg-extensions ; https://neon.com/docs/extensions/pg_uuidv7                                             |
| `gen_random_uuid()` (v4), no extension                               | Yes (core)                                                                   | https://www.postgresql.org/docs/14/functions-uuid.html                                                                                  |
| Drizzle `uuid()` column                                              | Yes                                                                          | https://orm.drizzle.team/docs/column-types/pg#uuid                                                                                      |
| Drizzle `defaultRandom()` → `DEFAULT gen_random_uuid()`              | Yes                                                                          | drizzle-orm@0.45.2 source (`pg-core/columns/uuid.js`)                                                                                   |
| Drizzle `.default(sql\`uuidv7()\`)`→`DEFAULT uuidv7()`               | Yes                                                                          | https://orm.drizzle.team/docs/column-types/pg#default-value                                                                             |
| Drizzle `$defaultFn()` client-side default                           | Yes, runtime-only (not in drizzle-kit output)                                | https://orm.drizzle.team/docs/column-types/pg#default-value                                                                             |
| Drizzle built-in `uuidv7` helper                                     | **No** (0.45.2 and 1.0.0-rc.4)                                               | `npm pack` grep of published packages, 2026-09-19                                                                                       |
| Better Auth default `id` = 32-char random base62                     | Yes                                                                          | https://github.com/better-auth/better-auth/blob/v1.7.4/packages/core/src/utils/id.ts                                                    |
| Better Auth `advanced.database.generateId` returning a UUIDv7 string | Yes (contract `=> string`)                                                   | https://www.better-auth.com/docs/concepts/database#id-generation ; https://www.better-auth.com/docs/reference/options#advanced-database |
| Better Auth `generateId: false` + DB `DEFAULT uuidv7()`, Drizzle+PG  | Yes (INSERT … RETURNING)                                                     | drizzle-adapter.ts v1.7.4 (lines 226–235, 781–788)                                                                                      |
| Deterministic legacy bigint → UUIDv7 mapping                         | **Hand-rolled** (SQL function above); sound with unique table discriminators | RFC 9562 §5.7 ; PG `uuid.c` implementation                                                                                              |
| UUIDv7 B-tree locality better than v4 (mechanism)                    | Yes                                                                          | RFC 9562 §2.1/§5.7 ; PG18 release notes ; Neon pg_uuidv7 docs                                                                           |
| Quantified B-tree benchmark from a primary source                    | **UNCONFIRMED**                                                              | —                                                                                                                                       |
| Explicit "PG18 GA" wording on Neon docs                              | **UNCONFIRMED** (docs list it as supported; no beta wording found)           | —                                                                                                                                       |
