# ADR-0012: Auth provider — Better Auth (self-hosted)

**Context:** `ARCHITECTURE.md` §8 originally decided Clerk (managed, free tier) — see the superseded rationale below. Revisited after checking Better Auth's docs against this project's actual stack: it officially supports mounting directly on Hono (Web Standard `Request`/`Response`, no adapter needed), runs on Cloudflare Workers with the `nodejs_compat` flag (already set in both `wrangler.toml` files for `AsyncLocalStorage`), has a documented SvelteKit integration (`hooks.server.ts` + `svelteKitHandler` + client), and its Drizzle adapter reuses `packages/db` directly — no second data store or vendor schema.

**Options considered:**
- Clerk (managed, free tier): hosted UI/session/MFA, but sits beside the stack as a separate vendor rather than integrating with it, and adds a free-tier MAU ceiling.
- Better Auth (self-hosted library, not roll-your-own): 2FA/passkeys/OAuth/SSO built in, so the "self-hosted = build auth from scratch" cost that originally favored Clerk mostly doesn't apply — it's a library, not a from-scratch build.
- Neon Auth (managed Better Auth): elegant "auth branches with the DB branch" story fitting ADR-0015, but its docs only cover Next.js/React — no Hono/SvelteKit/Workers guidance — and it locks auth data into Neon's managed schema. Rejected: would mean building an undocumented integration anyway, without gaining the managed convenience it's meant to provide.

**Decision:** Better Auth, self-hosted, mounted directly inside the existing `apps/api` Hono Worker and wired to `packages/db`.

**Known risk, accepted with a measurement plan:** Better Auth's default password hashing (scrypt) is deliberately CPU-intensive, and Cloudflare Workers' **free-tier** CPU limit is 10ms/request (Paid: 30s default, up to 5 min) — a login/signup request could exceed the free-tier budget. Given this app's small internal user base, registrations/logins are infrequent, not steady load, so the practical risk is low. Plan: ship it, measure actual scrypt CPU time against the free-tier limit in production (Workers request logs), and only then decide whether to (a) do nothing, if it fits, (b) upgrade `apps/api` to Workers Paid ($5/mo) if it doesn't, or (c) restrict to OAuth-only sign-in (Google/GitHub), which sidesteps password hashing entirely and stays free. Don't pre-optimize for (b)/(c) before the measurement says it's needed.

**Trade-offs:** Owning the login/signup UI (Clerk gives one for free) and carrying the CPU-limit risk above, in exchange for no external auth vendor, no MAU ceiling, and direct reuse of the Drizzle/Neon setup already built for this project (more consistent with ADR-0009's minimal-moving-parts/$0-cost bias than Clerk was).
