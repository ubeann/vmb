# ADR-0006: Data fetching — TanStack Query (Svelte Query)

**Context:** Many CRUD list/detail/edit screens need caching, refetching, and optimistic updates.

**Options considered:**

- Plain `fetch` + Svelte stores
- TanStack Query (Svelte Query)

**Decision:** TanStack Query.

**Trade-offs:** Adds a dependency and a learning curve for cache invalidation semantics, but removes a large amount of manual loading/error/refetch state management that would otherwise be hand-rolled per screen. Deliberately did _not_ add TanStack Table/Router — no screen currently justifies that complexity.
