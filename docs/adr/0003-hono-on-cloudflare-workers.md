# ADR-0003: Backend framework — Hono on Cloudflare Workers

**Context:** Needed a backend framework/runtime combo that fits the free-tier-maximizing, edge-first strategy.

**Options considered:**
- Express/Fastify on a traditional Node host
- Next.js API routes on Vercel
- Hono on Cloudflare Workers

**Decision:** Hono on Cloudflare Workers.

**Trade-offs:** 10ms CPU-time-per-request limit on the Workers free tier requires care for compute-heavy endpoints (reports, bulk exports) — mitigated via Cloudflare Queues where needed. Gains: no cold starts (unlike Lambda-style functions), generous 100k req/day free allowance, framework built specifically for this runtime.
