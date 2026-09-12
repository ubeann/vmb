# ADR-0008: Monorepo tooling — Turborepo over Nx

**Context:** Small monorepo (2 apps, a handful of shared packages), not a large multi-team org.

**Options considered:**
- Turborepo
- Nx

**Decision:** Turborepo.

**Trade-offs:** Nx offers more enforced architectural boundaries and generators, better suited to larger orgs with many teams. For this project's size, that's more ceremony than needed. Turborepo's setup is minimal (a `turbo.json` on top of existing workspaces) and pairs with free Vercel remote caching for build speed — used only for caching, not hosting.
