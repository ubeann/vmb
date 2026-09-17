# ADR-0015: Staging environment strategy

**Context:** `ARCHITECTURE.md` §11 left the staging strategy open. The scaffold in this ticket already needs a place to validate CI/deploy changes without touching the production Neon database or the production Workers/Pages deployments.

**Options considered:**

- No separate staging environment; test against production directly (viable only because of the small internal user base, but risky for schema migrations and deploy changes).
- Separate Neon branch (production-like data via Neon's branching) + separate Cloudflare Workers/Pages environment (`[env.staging]` in `wrangler.toml`, deployed from a non-`main` branch or manually).

**Decision:** Separate Neon branch + separate Workers/Pages environment. Both `apps/api/wrangler.toml` and `apps/web/wrangler.toml` already define an `[env.staging]` block (`vmb-api-staging`, `vmb-web-staging`) as part of this ticket's scaffold; the corresponding Neon staging branch and its connection string are provisioned and wired via `fnox` when the team is ready to deploy to it.

**Trade-offs:** Costs a second Workers/Pages deployment target and a second Neon branch to keep in sync (schema-wise) with production — but for near-zero marginal cost given Neon's branching and Workers/Pages free tiers. In return, deploy and migration changes get a real dry run before touching production, which matters more as the app moves from this scaffold into actual CRUD features.
