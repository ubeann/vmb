# ADR-0038: Effect — not adopted now

**Context:** Effect was proposed for typed errors, retries and timeouts, and dependency injection. It would help in real places. The master store's contract is `Promise<T>`, so the errors it throws don't show in its type (`packages/db/src/master/index.ts`). That leaves the `instanceof` chain in `apps/api/src/routes/master/index.ts` to map them, and a new error class nobody maps silently becomes a 500. `sendEmail` (`apps/api/src/email.ts`) makes one attempt at Resend with no retry or timeout. Checked on 2026-09-29, the stable line is `effect@3.22.2`, and v4 is at `4.0.0-rc.118`, with its migration guide still saying "APIs may change". Research: `docs/research/effect-knip-alchemy.md` §2.

**Options considered:**

- Adopt Effect 3 now — rejected: it means a v3→v4 migration later, across every file it has touched by then.
- Adopt Effect 4 RC now — rejected. It conflicts with three settled decisions:
  - ADR-0007: Superforms 2.30.2 supports only Effect `^3.21.0`, and its Effect adapter uses v3 APIs that v4 renames. Moving `packages/types` to Effect Schema would break "one schema for the API and the forms".
  - ADR-0004: Effect's HttpApi or Rpc would put a second routing layer over Hono, the same objection ADR-0004 makes against tRPC.
  - ADR-0002 and ADR-0016: Effect-native Drizzle needs `drizzle-orm` 1.0 RC over the TCP `pg` driver, the switch ADR-0016 rejected.
- Use Effect only inside handlers, wrapping the Promise store — deferred: Promise and Effect code side by side, converted at every seam (Better Auth hooks, Hono handlers, SvelteKit actions), is a cost for a small team before any need calls for it.
- Don't adopt it; keep Zod, Hono RPC and Promise-based stores — chosen.

**Decision:** Not adopted now. Revisit when all three hold:

- Effect 4.0 is published as npm `latest`.
- Superforms ships a v4-compatible adapter, or `packages/types` moves to Standard Schema.
- A concrete need appears that Promises handle badly, such as R2 upload pipelines with retries, bulk imports or exports on Workers, or fan-out with concurrency limits.

If a spike is wanted first, the smallest one is wrapping `sendEmail` with a retry, a timeout and a tagged `EmailSendError`, run through `Effect.runPromise` at the Better Auth callback. Zod, Hono RPC and the store stay as they are. Measure the bundle size and the CPU time per request on Workers before going further, since neither has been measured.

**Trade-offs:** Domain errors stay out of the store's types, and retries stay hand-written where they are added. In return, the forms, the RPC contract and the database driver stay on decisions that are settled and measured, and no one has to learn a new programming model before a module needs it. Deciding Effect also gates Alchemy, which requires Effect 4 (ADR-0039).

**Rechecked 2026-10-02:** the first condition holds — `effect@4.0.0` became npm `latest` on 2026-10-01. The other two do not: Superforms 2.31.0 still peers `effect ^3.21.0`, and no Promise-shaped pain has appeared in the code. The decision stands. Research: `docs/research/typescript-6-and-effect-recheck.md`.
