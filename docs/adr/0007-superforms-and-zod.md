# ADR-0007: Forms & validation — Superforms + Zod

**Context:** Admin panel is largely CRUD forms; needed validation shared between client and server.

**Options considered:**
- Hand-rolled form state + manual validation
- Superforms + Zod

**Decision:** Superforms + Zod.

**Trade-offs:** Superforms has its own conventions to learn, but provides progressive enhancement (forms work without JS) and removes boilerplate for the volume of CRUD forms in this app. Zod schemas are defined once in `packages/types` and reused for both backend request validation and frontend form validation — avoids validation-logic drift between layers.
