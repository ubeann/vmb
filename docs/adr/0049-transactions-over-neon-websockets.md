# ADR-0049: Transactions over a per-request Neon WebSocket; HTTP stays the default

**Context:** `packages/db` reaches Neon through the HTTP driver (`drizzle-orm/neon-http`), cached per Worker isolate. That driver has no interactive transactions: `db.transaction()` throws, and `db.batch()` is atomic but cannot read a result and then decide the next statement. The Master store works around it with single-statement CTEs (`createUser`) and accepts a race: the check that a caller may change a user's roles and the write it guards are separate statements (ADR-0045's trade-offs). The domain modules ahead (stock movements, approvals, expenses) will need several statements to commit or roll back together, with reads in between. The store's tests run on PGlite, which supports `db.transaction()` but not `db.batch()`.

**Options considered:**

- **HTTP only**, using `db.batch()` for atomic writes. No read-then-decide, and PGlite cannot run it, so tests could not prove a rollback.
- **HTTP by default, plus a Neon WebSocket connection opened only for a transaction** (`@neondatabase/serverless`'s `Pool`/`Client` through `drizzle-orm/neon-serverless`).
- **WebSocket for every query.** Workers cannot reuse a connection across requests, so every request would open one, losing the isolate cache and paying the connection setup on every call.
- **Hyperdrive with `pg`**, which Neon's Workers guide now recommends. It pools at Cloudflare's edge and supports interactive transactions, but its query cache is on by default and is not invalidated by writes, so it would have to be disabled for sessions, permissions and read-after-write; each per-PR preview, which has its own Neon branch, would need its own Hyperdrive config created and deleted by `preview.yml` and `cleanup.yml`; and the Workers Free plan caps it at 10 configs and 100,000 queries a day. See ADR-0016's amendment.

**Decision:**

- The HTTP driver stays the default for every single-shot query, cached per isolate as today.
- A use case that must read and write atomically runs inside `db.transaction(async (tx) => …)` on a Neon WebSocket connection opened for that request and closed after the reply (`waitUntil`). Such a connection is never cached at module scope: Workers forbids reusing I/O objects across requests.
- Store code calls only `db.transaction`, never `db.batch`, so the same code runs on PGlite and its tests can prove the rollback.
- Work that needs no database (hashing a password, the breached-password lookup) happens before the transaction opens, so a transaction holds its connection only for SQL.
- A single statement that is already atomic, such as `createUser`'s CTE, stays as it is.
- The connection uses the same `DATABASE_URL`; no new secret or binding.

**Trade-offs:** A request that opens a transaction pays the WebSocket setup, about four round trips with Neon's pipelined connect, before its first statement; every other request is unchanged. The store's dependencies carry two kinds of handle, the cached HTTP one and a per-request transaction opener. Moving to Hyperdrive later changes `createDb` and the CI wiring, not store code, because store code only ever calls `db.transaction`. Revisit Hyperdrive when the account moves to Workers Paid (ADR-0012 recommends it), when measured latency shows multi-query requests or transaction setup matter, or when transactions become the common path rather than the exception.

**Amendment (2026-10-12): when each pattern applies (owner's rule of thumb, #413).** A check that can be written as SQL goes into the write's own `where`: one statement on the HTTP driver, with a read afterwards only to word the refusal (`deleteDivision`'s `DIVISION_IN_USE`, a user delete's reach test, ADR-0055). The transaction opener is for a use case that must read, decide in code, then write, such as the role-changing save, which reads the roles the user holds, decides in code which to add and remove, then writes. Reach for the transaction only when the check cannot be expressed in SQL; it costs the WebSocket setup above, and an in-statement test costs nothing.
