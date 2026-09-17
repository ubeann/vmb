# ADR-0002: ORM — Drizzle over Prisma

**Context:** Backend needs to run on Cloudflare Workers (edge runtime).

**Options considered:**

- Prisma
- Drizzle

**Decision:** Drizzle.

**Trade-offs:** Prisma's query engine binary is incompatible with edge runtimes without extra workarounds (Data Proxy, etc.). Drizzle is pure TypeScript/SQL, works natively on Workers, but has a less mature ecosystem and fewer visual tooling options than Prisma Studio.
