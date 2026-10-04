# ADR-0044: TypeScript 6 until the tools support 7

**Context:** The repo was on TypeScript 5.9. TypeScript 7.0, the Go port, has been npm `latest` since 2026-07-08, but it ships no compiler API. svelte-check and typescript-eslint both call that API, so Dependabot's 5.9 → 7.0 bump (#38) fails lint before `tsc` even runs. TypeScript 6.0 is the last JavaScript-based release and the version those tools support alongside 7. SvelteKit 3 requires it. Moving to 6.0 needs no tsconfig change here, and 6.0 claims no speed gain over 5.9. Research: `docs/research/typescript-6-and-effect-recheck.md`.

**Options considered:**

- Stay on 5.9 — rejected: it blocks SvelteKit 3 and the side-by-side TypeScript 7 setup, and leaves Dependabot's TS 7 PR red every week.
- Move to 6.0.3 and ignore TypeScript 7 in Dependabot — chosen.
- Move to 7.0 with 6.0 aliased for the tools (`typescript: npm:@typescript/typescript6`, `@typescript/native: npm:typescript@7`) — deferred: unmeasured here, pnpm's peer checks and Dependabot's handling of the alias are unverified, and svelte-check's `--tsgo` mode can report a crashed check as 0 errors (sveltejs/language-tools#3127), which the CI gate cannot accept.

**Decision:** `typescript` is `^6.0.3` in every manifest. Dependabot ignores `typescript` `>=7`, so 6.x patches still arrive. Revisit when typescript-eslint and svelte-check both support TypeScript 7, which in practice means TypeScript 7.1's API; then remove the ignore. Running TypeScript 7 for `tsc` in `api`, `db` and `types` through the alias is a separate experiment, kept only if a local timing shows it pays.

**Trade-offs:** Type checks run no faster than before; the faster Go compiler waits on the tools. In return the repo is on the version its tools support, ready for SvelteKit 3, and the code already checks with `--stableTypeOrdering`, which TypeScript 7 always uses. The ignore rule means a TypeScript 7.x release raises no PR, so lifting it depends on rechecking the tools rather than on Dependabot.
