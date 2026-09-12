# ADR-0009: Hosting — Cloudflare only, not split with Vercel

**Context:** Wanted to maximize free-tier usage across the project while minimizing platforms to manage.

**Options considered:**
- Split: frontend on Vercel, backend on Cloudflare Workers
- All on Cloudflare (Pages + Workers)

**Decision:** All on Cloudflare.

**Trade-offs:** Loses Vercel's zero-config Next.js deploy convenience, requires manual `wrangler deploy` wiring per app. Gains: single free-tier budget/dashboard to track, Workers and Pages Functions share the same request pool, avoids managing two hosting platforms for one small app. Vercel remote caching is still used for Turborepo build speed — this doesn't require hosting there.
