# ADR-0004: API type-safety — Hono RPC over tRPC

**Context:** Wanted end-to-end type safety between frontend and backend without duplicating routing logic.

**Options considered:**

- tRPC
- Hono RPC (`hono/client`)
- Manual OpenAPI + codegen

**Decision:** Hono RPC.

**Trade-offs:** tRPC would add a second procedure/routing abstraction on top of Hono's own routes — redundant since Hono already infers types from route definitions via `hc<AppType>()`. Fewer dependencies, one less concept to maintain. Slightly less ecosystem tooling than tRPC (e.g., fewer community examples), but the pattern is simple enough that this hasn't mattered in practice.
