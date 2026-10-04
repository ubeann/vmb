# ADR-0042: Auth rate limits — on explicitly, counted in Postgres, keyed by the real client IP and by email

**Context:** Better Auth 1.7.5 has rate limits: 100 requests per 10 s globally, and its email OTP plugin adds 3 per 60 s on each OTP path. It turns them on only when `NODE_ENV` is `production`, and the `apps/api` Worker sets no `NODE_ENV`. So, by inference from the source rather than an observed request, the limits are off in production today. Even when on, the default store is an in-memory `Map` per Worker isolate, which no other isolate sees. The key is also wrong: the browser never calls `apps/api` directly. Every auth call is a server-side fetch from `apps/web`, which forwards cookies but no client IP (`apps/web/src/lib/api-access.ts`). By inference again, the API sees one address for everyone, so a per-IP limit would let three people's attempts block the whole office. A resend countdown on `/activate` and a per-email cap on code requests both need limits that actually hold. Storage must fit the Cloudflare free plan and the per-PR preview workflow (ADR-0019, ADR-0029), where each preview is a `wrangler versions upload` of the production Worker and has its own Neon branch.

**Options considered:**

- Workers KV, via Better Auth `secondaryStorage` or `rateLimit.customStorage`. Cloudflare's docs advise against KV for rate limiting and counters. It is eventually consistent, taking 60 s or more to reach other locations, and concurrent writes overwrite each other. The free plan allows 1,000 writes a day for the whole account, shared by production and every preview. A version preview uses production's bindings, so previews are not isolated. `secondaryStorage` would also move sessions and verification values (OTP codes) out of Postgres, against ADR-0034. Rejected.
- Cloudflare's Rate Limiting binding: counters are kept per location and are approximate by Cloudflare's own description. It needs one binding per rule, and free-plan terms were not confirmed. Not chosen; a candidate optimisation later.
- Durable Objects, SQLite-backed: consistent and within free quotas, but the most work, and the namespace is shared with production under `versions upload`.
- Postgres, via Better Auth `rateLimit.storage: "database"`: a `rateLimit` table updated atomically, so counts hold across isolates. It costs about two queries per limited request and no Cloudflare quota. Each preview's Neon branch isolates its counters, which are removed with the branch.

**Decision:**

- **Store and switch:** `rateLimit: { enabled: true, storage: "database" }` in every deployed environment and in local dev. The `rateLimit` table is defined in `packages/db` with a migration. Request-step integration tests use the real Drizzle adapter and the database test harness (in-memory PGlite by default, Postgres when `TEST_DATABASE_URL` is set), so they exercise atomic counters and pruning.
- **`/get-session` is exempt** (`customRules`), so reading a session costs no extra query.
- **Real client IP:** `apps/web` sends the browser's address from `event.getClientAddress()` in a header, together with a shared secret. `apps/api` uses that header as the client IP only when the secret matches, and otherwise uses `cf-connecting-ip`.
- **Per-email cap:** code requests (`/email-otp/request-password-reset`) are also counted per email, at most 5 an hour. The count is keyed on the email as typed, so registered and unregistered emails hit the same limit (#232).
- **Countdown:** the `/activate` resend countdown is a flat 60 s, matching the OTP plugin's 3 requests per 60 s. The server limits are the real gate.

**Trade-offs:** Each limited auth request adds Neon round trips and compute, accepted for counts that hold on the free plan with no new Cloudflare resource to provision per preview. The client-IP header adds one secret to rotate (production, preview secrets, fnox). The API must never trust that header without the secret, or anyone could pick their own rate-limit key.
