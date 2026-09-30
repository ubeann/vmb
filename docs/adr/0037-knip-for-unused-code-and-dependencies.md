# ADR-0037: Knip for unused files, dependencies and exports

**Context:** Nothing checked for dead code or stale dependencies. ESLint's `no-unused-vars` sees one file at a time, so an export no other file imports, a file nothing reaches, or a `package.json` entry nothing uses all passed CI. The Master CRUD is the first of several legacy modules to port (trucking, warehouse, expense), and each port adds schemas, store functions and web helpers that later refactors can orphan. Dependabot and shadcn-svelte churn leave dependencies behind the same way. Knip's first run on the repo found an unused barrel file (`packages/db/src/import/index.ts`), a redundant devDependency (`@vitest/browser`, already a dependency of `@vitest/browser-playwright`), an unused exported type and eight exports used only in their own file. Research: `docs/research/effect-knip-alchemy.md` §1.

**Options considered:**

- Knip, repo-wide, as a named step in `ci.yml`'s `Verify` job — chosen. Its plugins cover this stack out of the box (SvelteKit, Svelte, Vite, Vitest, Wrangler, Drizzle, pnpm workspaces, GitHub Actions, mise), so the config holds only exceptions.
- depcheck plus ts-prune — rejected: two tools covering half the job each, where Knip checks files, dependencies and exports in one pass.
- A lefthook pre-commit hook — rejected: Knip analyses the whole project, and hooks must stay fast. The CI gate is what counts (ADR-0023).
- Turn on `ignoreExportsUsedInFile` — rejected: dropping the `export` is the fix, and keeping the check stops a module's surface from growing by accident.

**Decision:** `knip` is a root devDependency. `pnpm knip` runs `svelte-kit sync` first (Knip loads `apps/web/vite.config.ts`, which needs the generated `.svelte-kit/tsconfig.json`), then Knip. CI runs it as its own `Knip` step right after `Format`, with the `github-actions` reporter so findings annotate the diff. It needs no secrets, so it runs for every actor, Dependabot included (ADR-0020), and always repo-wide (ADR-0023). `knip.jsonc` holds only commented exceptions:

- Hand-run scripts (`apps/web/scripts/*.mjs`, `docs/design/**/*.mjs`) are entries.
- `@neondatabase/serverless` in `apps/api` and `playwright` at the root are known-used dependencies Knip cannot see.
- `fnox` is a mise binary, not an npm one.
- The shadcn-svelte registry copies in `apps/web/src/lib/components/ui/**` ignore unused `exports` and `types` only. Their barrels export every part so a component drops in whole, and trimming them would fork the registry. Unused files and dependencies there still report.

A new finding is fixed, not ignored. An exception goes in `knip.jsonc` with a comment saying why. `knip --fix` stays a local tool, never a CI step, because it deletes files and `package.json` entries.

**Trade-offs:** One more step in `Verify`. It skips turbo's cache and reruns in full every time, but a full run takes under 3 seconds locally. A plugin can miss an entry point, which shows up as a false "unused file" and costs an exception line. In return, dead code and stale dependencies fail on the PR that creates them, not in a cleanup PR months later.
