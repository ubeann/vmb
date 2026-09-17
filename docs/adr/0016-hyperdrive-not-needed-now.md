# ADR-0016: Cloudflare Hyperdrive — not adopted now

**Context:** Raised alongside the Better Auth decision (ADR-0012), on the assumption it might help with Workers' CPU-time budget for auth. Checked against current docs: Hyperdrive accelerates Workers→database _connections and query latency_ (global connection pooling, optional query caching) for **TCP** Postgres drivers (`pg`/node-postgres, `postgres.js`). It does not reduce Workers **CPU time**, which is the actual constraint on password-hashing cost — the two are unrelated resources (ARCHITECTURE.md §6 already distinguishes CPU time from I/O wait). Separately, `packages/db` uses Neon's HTTP-fetch driver (`@neondatabase/serverless` via `drizzle-orm/neon-http`), which Cloudflare/Neon's own Hyperdrive docs don't cover — only the TCP drivers are documented as compatible.

**Options considered:**

- Adopt Hyperdrive now, switching `packages/db` from the Neon HTTP driver to a TCP driver (`drizzle-orm/node-postgres` + `pg`) to use it.
- Don't adopt it; keep the Neon HTTP driver, which was chosen specifically for edge/Workers compatibility (ADR-0001, ADR-0002) and already avoids the connection-setup-latency problem Hyperdrive solves for traditional TCP drivers, via Neon's own server-side pooling.

**Decision:** Not adopted now.

**Trade-offs:** Switching drivers to gain Hyperdrive would reverse a settled architecture choice (the HTTP driver) for a benefit — connection pooling — that choice already sidesteps a different way, and it wouldn't touch the actual concern that prompted the idea (auth CPU time). Hyperdrive's query-caching feature could be independently useful later for read-heavy CRUD screens, but that's a distinct, unmeasured need — revisit only if real query latency data (not this auth decision) calls for it.
