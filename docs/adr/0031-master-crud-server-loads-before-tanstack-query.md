# ADR-0031: Master CRUD data fetching — server loads before TanStack Query

**Context:** ADR-0006 selected TanStack Query for the admin panel's CRUD screens, and `docs/ARCHITECTURE.md` §7.2 repeats it as the data-fetching layer. Issue #6 is the first CRUD module to land, and it needed a fetching shape for list/detail/create/edit screens. TanStack Query is not a dependency of `apps/web` yet, and each of these screens is a server-rendered page whose data comes from `apps/api` through the existing `withApiClient` seam (issue #82) with Superforms handling the forms (ADR-0007).

**Options considered:**

- Install TanStack Query now and fetch through `createQuery`/`createMutation` from the client, as ADR-0006 describes.
- Fetch in SvelteKit `load` functions through `withApiClient`, submit through form actions, and render server-side — no client cache yet.
- A hybrid: server loads for initial render plus TanStack Query for client-side refetching.

**Decision:** Server loads and form actions for the Master module; TanStack Query is deferred, and ADR-0006 remains the plan for when a screen actually needs client-side caching, background refetching or optimistic updates.

**Trade-offs:** Server-rendered CRUD keeps one data path (the API access seam), works without JavaScript, and needs no new dependency; the cost is that a mutation's effect is seen after a full navigation rather than an optimistic client update, and list filters/page changes are round trips. That is acceptable for an internal tool whose lists are small and whose users are few. Reintroducing TanStack Query later is additive — a client query layer can wrap the same API access seam without changing the routes or the API — but doing it before a screen needs it would add cache-invalidation machinery that currently has nothing to invalidate. The hybrid was rejected as the worst of both: two fetching paths in the same pages. The trade-off is deliberately time-boxed by need, not by module: the first screen measured to need client-side caching reopens ADR-0006.
