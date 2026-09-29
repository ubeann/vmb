# Effect, Knip and Alchemy: should VMB adopt them?

Research date: **2026-09-29**. Sources are primary only: official docs, the libraries' GitHub repos and source, and npm registry metadata (`npm view`, run on that date). Repo facts cite `path:line` in this worktree.

**TL;DR**

| Library | Verdict                                      | First step                                                                                                                                                    |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Knip    | **Adopt**                                    | Add `knip` at the root with a small `knip.json`, triage one local run, then add a `Knip` step to CI's `Verify` job next to `Format`                           |
| Effect  | **Skip for now** (revisit once v4 is stable) | Nothing now. Record an ADR saying "not adopted now", with revisit triggers. If you want a spike later, wrap `sendEmail` in `apps/api/src/email.ts`            |
| Alchemy | **Skip**                                     | Nothing now. Provision R2 with wrangler (ADR-0013). Re-evaluate after Alchemy v2 goes GA, and only if the bespoke preview scripts become a maintenance burden |

---

## 0. How the repo works today (the baseline these tools would change)

- **API errors, validation and DI.** Hono routes validate with Zod through `hono/validator` (`apps/api/src/routes/master/http.ts:38-46`), because that is what lets `hc<AppType>` infer inputs (ADR-0004). Domain errors are plain `Error` subclasses (`packages/db/src/master/errors.ts:1-23`). One `onError` maps them to HTTP statuses (`apps/api/src/routes/master/index.ts:33-45`). Postgres unique violations are found by walking the `cause` chain (`packages/db/src/master/db.ts:34-65`). DI is done by hand:
  - `createMasterRoutes(resolveStore)` takes a factory, so tests can pass a fake store (`routes/master/index.ts:24`).
  - Each isolate caches its own store and auth instance (`apps/api/src/master.ts:8-13`, `apps/api/src/auth.ts:74-79`).
  - The store's contract is `Promise<T>`, and the errors it throws do not show up in the type (`packages/db/src/master/index.ts:46-67`).
- **Web side.** Three hand-rolled result unions: `ApiAccessResult` (`apps/web/src/lib/api-access.ts:33`), `ApiResult` (`apps/web/src/lib/master/api.ts:33-34`) and `AuthCallResult` (`apps/web/src/lib/auth-action.ts:17-19`). Forms go through Superforms with the `zod4` adapter (`apps/web/src/lib/master/form-action.ts:25`). Shared schemas live in `packages/types` (ADR-0007).
- **DB driver.** `drizzle-orm/neon-http` over `@neondatabase/serverless` (`packages/db/src/client.ts:5-8`). The repo has its own migrator and replay chain (`packages/db/src/migration/*`, ADR-0024). Hyperdrive and TCP drivers were deliberately not adopted (ADR-0016).
- **Provisioning and deploys.** Nothing is IaC. The pieces are:
  - Production: `wrangler deploy` and `wrangler pages deploy` in `ci.yml:303-339`.
  - One-time setup: an interactive wizard that sets GitHub secrets, creates the Pages project and puts Worker secrets (`scripts/setup-deploy.sh:236-390`).
  - Per-PR previews: `preview.yml` (1,136 lines) and `cleanup.yml` (358 lines), plus about 600 lines of shell modules (`scripts/preview-identifiers.sh`, `neon-preview-branches.sh`, `pages-preview-deployments.sh`, `code-relevant-paths.sh`). Each preview creates and renames a Neon branch, runs migrations and seeds, does `wrangler versions upload --preview-alias` with a `--secrets-file` assembled from fnox (`preview.yml:557-675`), deploys to Pages, prunes old Pages deployments, registers a GitHub deployment, posts a schema diff, and counts versions (ADR-0019, 0029, 0030, issue #152).
  - R2 is decided (ADR-0013) but **not provisioned yet**: there is no `r2_buckets` binding in either `wrangler.toml`.
- **Dead-code and dependency tooling.** None. ESLint has only `no-unused-vars` (`packages/config/eslint.config.js`). There is no knip, depcheck or ts-prune anywhere in the repo.

---

## 1. Knip

### What it is, version and maturity

- Knip "will lint your project and report unused dependencies, exports and files" ([getting started](https://knip.dev/overview/getting-started)).
- The current version is **`knip@6.38.0`** (npm `latest`, published 2026-09-23). v6.0.0 shipped 2026-03-20. The repo has about 12.4k GitHub stars and was pushed 2026-09-29 ([repo](https://github.com/webpro-nl/knip)).
- It requires Node `^20.19.0 || >=22.12.0` (npm `engines`). The docs say "Knip v6 requires at least Node.js v20.19.0". The repo pins Node 26 in `.mise.toml`.
- It is mature and very actively maintained.

### Fit with this stack

These plugins exist in [`packages/knip/src/plugins`](https://github.com/webpro-nl/knip/tree/main/packages/knip/src/plugins) and turn on automatically:

| Stack piece                            | Knip plugin                                                                                                                                                                      | Notes                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| SvelteKit / Svelte                     | `sveltekit` (enabled by `@sveltejs/kit`, reads `svelte.config.js` and the vite config), `svelte`                                                                                 | `.svelte` compiler "automatically enabled" ([compilers](https://knip.dev/features/compilers))                         |
| Vite / Vitest                          | `vite`, `vitest`                                                                                                                                                                 | Picks up `apps/web/vite.config.ts` and the vitest `projects`                                                          |
| Turborepo                              | `turbo`                                                                                                                                                                          | Only handles `turbo gen` entries. `turbo.json` tasks call `package.json` scripts, and Knip reads those                |
| pnpm workspaces                        | built in, reads `pnpm-workspace.yaml` ([monorepos](https://knip.dev/features/monorepos-and-workspaces)), plus a `pnpm` plugin                                                    | `workspace:*` and cross-workspace exports are tracked                                                                 |
| Drizzle                                | `drizzle` (enabled by `drizzle-kit`, reads `drizzle.config.ts`)                                                                                                                  |                                                                                                                       |
| Wrangler                               | `wrangler` (reads `wrangler.{json,jsonc,toml}`)                                                                                                                                  | `apps/api/wrangler.toml`'s `main = "src/index.ts"` becomes an entry                                                   |
| Prettier, ESLint, Tailwind, Playwright | `prettier`, `eslint`, `tailwind`, `playwright`                                                                                                                                   |                                                                                                                       |
| GitHub Actions, mise                   | `github-actions` (parses `run:` in workflows and composite actions), `mise` (enabled by `.mise.toml`)                                                                            |                                                                                                                       |
| lefthook                               | `lefthook` exists, but it only turns on when `lefthook` is an npm dependency ([source](https://github.com/webpro-nl/knip/blob/main/packages/knip/src/plugins/lefthook/index.ts)) | Here lefthook comes from mise, so this plugin stays off. That doesn't matter: the hooks call scripts Knip sees anyway |
| tsx                                    | `tsx`                                                                                                                                                                            | Covers `packages/db`'s `db:*` scripts                                                                                 |

No ADR conflicts. Knip fits ADR-0023 (the PR gate mirrors master): the check is repo-wide and deterministic, needs no secrets, and so also runs on Dependabot and fork PRs (ADR-0020, ADR-0030).

### Concrete improvements (what a first run would likely surface)

`node_modules` is not installed in this worktree and the brief was read-only, so Knip was **not run**. These are hand spot-checks of what it reports.

- **Exports used only in their own file** (reported unless `ignoreExportsUsedInFile` is set, see [configuration](https://knip.dev/reference/configuration)):
  - `submittedId` (`apps/web/src/lib/master/form-action.ts:44`)
  - `queryStrings` (`apps/web/src/lib/master/api.ts:65`)
  - `issuesFrom` (`apps/api/src/routes/master/http.ts:26`)
  - the `ApiRequestEvent` type (`apps/web/src/lib/api-access.ts:27`)
  - None of these is imported anywhere else in `apps/` or `packages/`.
- **A devDependency that is probably unused.** `apps/api/package.json` lists `@neondatabase/serverless`, but nothing under `apps/api/src` imports it. It may be there on purpose (type resolution through `@vmb/db`'s TS sources). If so, Knip makes that intent explicit through `ignoreDependencies`.
- **Not a false positive.** `@internationalized/date` in `apps/web` has no direct import, but it is a required peer of `bits-ui` (`pnpm-lock.yaml:2064-2069`). Knip does not flag deps that are "a peer dep of another" ([`DependencyDeputy.ts`](https://github.com/webpro-nl/knip/blob/main/packages/knip/src/DependencyDeputy.ts)).
- **Ongoing value.** The Master CRUD is the first of several modules still to port (trucking, warehouse, expense). Each port adds `packages/types` schemas, store functions and web helpers. Knip catches schemas and helpers left orphaned by later refactors, and deps left behind by Dependabot or shadcn churn.

### Costs and risks

- Low. It is a devDependency only, with no runtime or bundle impact.
- Expect some noise from the shadcn-svelte registry copies in `apps/web/src/lib/components/ui/**` (barrel re-exports that go unused). Silence those with `ignoreIssues` for `exports`/`types` on that glob, not with `ignore`. The docs warn "hiding a result is not the same as resolving it" ([handling issues](https://knip.dev/guides/handling-issues)).
- mise-installed binaries used in workflows (`fnox`, `actionlint`, `shellcheck`, `lefthook`) will likely need `ignoreBinaries`.
- `--fix` can delete files and `package.json` entries ([auto-fix](https://knip.dev/features/auto-fix)). Keep it out of CI and use it locally with `--fix-type exports,types` at most.

### Recommendation: **adopt**

Smallest first step:

1. Add `knip` (plus the `typescript`/`@types/node` it expects) as a root devDependency, and add a `"knip": "knip"` root script.
2. Add a starting `knip.json` and adjust it after the first run:
   ```json
   {
     "ignoreIssues": { "apps/web/src/lib/components/ui/**": ["exports", "types"] },
     "ignoreBinaries": ["fnox", "actionlint", "shellcheck", "lefthook"]
   }
   ```
3. Run `pnpm knip` locally and fix or ignore every finding in one PR.
4. Add a named `Knip` step to `ci.yml`'s `Verify` job, right after `Format` (`ci.yml:162-167`). It is secret-free, so it runs for every actor. Use `--reporter github-actions` for inline annotations ([reporters](https://knip.dev/features/reporters)).
5. Keep it out of lefthook. It analyses the whole project, and hooks must stay fast (`lefthook.yml` header).

---

## 2. Effect

### What it is, version and maturity

- A TypeScript framework for typed errors, dependency injection ("services and layers"), concurrency (fibers, queues), retries and timeouts, Schema, and logging/metrics/tracing ([introduction](https://effect.website/docs/getting-started/introduction/)).
- **Stable: `effect@3.22.2`** (npm `latest`, 2026-09-09).
- **v4: `4.0.0-rc.118`** (npm `rc`, 2026-09-28).
  - The beta line ran from 2026-02-18 to 2026-08-10, and RCs started 2026-08-12.
  - The docs site labels it "v4 (rc)" ([v4 docs](https://effect.website/docs/v4)).
  - The canonical [`MIGRATION.md`](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md) still says "Effect v4 is currently in beta. APIs may change".
  - `effect-smol` is archived: "Effect V4 has moved to the canonical `Effect-TS/effect` repository" ([effect-smol](https://github.com/Effect-TS/effect-smol)).
- v4 facts that matter here ([MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md)):
  - `@effect/platform`, `@effect/rpc` and others merge into `effect`.
  - `http`, `http-api`, `rpc`, `schema`, `sql` and more are **unstable modules**, which "may receive breaking changes in minor releases".
  - Bundle size: "a minimal Effect program bundles to ~6.3 KB (minified + gzipped). With Schema, ~15 KB."

### Fit with this stack, and ADR conflicts

- **Workers runtime.** Nothing blocks it. v4's `HttpRouter.toWebHandler` yields a Web-standard handler ([`HttpRouter.ts`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/http/HttpRouter.ts)). Cloudflare-specific SQL drivers exist (`sql/d1`, `sql/sqlite-do`), but there is no `platform-cloudflare` package: `packages/platform` has only browser, bun, deno, node and node-shared ([packages](https://github.com/Effect-TS/effect/tree/main/packages)). The simple fit is `Effect.runPromise` inside ordinary Hono handlers. The bundle cost is small next to the 64 MiB limit ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)). Its CPU cost against the free-tier budget in ADR-0003 and ADR-0012 is **unmeasured**.
- **ADR-0007 (Superforms + Zod): conflicts.**
  - Superforms 2.30.2 declares an `effect` peer of **`^3.21.0`** (npm).
  - Its Effect adapter is written against v3 APIs: `effect/ParseResult`, `Either` and `JSONSchema` ([`adapters/effect.ts`](https://github.com/ciscoheat/sveltekit-superforms/blob/main/src/lib/adapters/effect.ts)).
  - v4 renames those to `SchemaIssue`/`SchemaParser`, `Result` and `JsonSchema` ([v3-to-v4 map](https://github.com/Effect-TS/effect/blob/main/migration/v3-to-v4.md)).
  - The fallback is Superforms' `standard` adapter, which _requires_ explicit `defaults` because it cannot introspect the schema ([`adapters/standard.ts`](https://github.com/ciscoheat/sveltekit-superforms/blob/main/src/lib/adapters/standard.ts)).
  - Net effect: replacing Zod in `packages/types` with Effect Schema breaks the "defined once, reused by API and forms" property, or pins you to Effect 3.
- **ADR-0004 (Hono RPC over tRPC): conflicts if Effect HttpApi or Rpc is used.** That would be a second routing abstraction over Hono, which is exactly the objection ADR-0004 makes against tRPC. You could keep Zod in `hono/validator` and use Effect only inside handlers. A Hono validator for Effect Schema exists (`@hono/effect-validator@1.2.0`, peer `effect >=3.10.0`, last published 2024-12), and so does `@hono/standard-validator@0.4.0`.
- **ADR-0002, ADR-0016 (Drizzle over Neon HTTP, no Hyperdrive): conflicts for Effect-native SQL.**
  - Drizzle's Effect integration needs `drizzle-orm@rc` (1.0) with `@effect/sql-pg` over `pg` ([Drizzle + Effect Postgres](https://orm.drizzle.team/docs/connect-effect-postgres)). That is a TCP driver, the switch ADR-0016 rejected.
  - `@effect/sql-drizzle` exists only on v3 (0.51.0, no v4 tag). v4's `packages/sql` has no drizzle package.
  - The repo is on `drizzle-orm@^0.45.2`.
  - Realistically, Effect would wrap the existing Promise-based store with `Effect.tryPromise`.

### Where it would genuinely help

1. **Typed domain errors.** A store that returns `Effect<Division, MasterNotFoundError | MasterConflictError>` instead of `Promise<Division>` (`packages/db/src/master/index.ts:46-67`). That would make the `instanceof` ladder in `routes/master/index.ts:33-45` exhaustive at compile time. Today a new error class that nobody maps silently becomes a 500.
2. **Retries and timeouts.** `sendEmail` (`apps/api/src/email.ts:65-81`) makes one attempt at Resend and throws. The first query after Neon's autosuspend can take 1–3 s (`docs/ARCHITECTURE.md` §5). `Effect.retry(Schedule…)` and `Effect.timeout` express this cleanly.
3. **One result type.** The three web result unions (§0) could collapse into Effect's `Exit`/`Result`, though they currently cross the Superforms and SvelteKit `fail()` boundary, which is Promise-shaped.
4. **DI via Layers.** This would replace the isolate caches and factory injection (`master.ts:8-13`, `auth.ts:74-79`, `routes/master/index.ts:24`). But those are already small, explicit and testable. The gain here is marginal.

### Costs and risks

- **Learning curve and reach.** The generator style, services, layers and the requirements type parameter affect every file they touch. Two apps, one small team, AI-agent-heavy development: every agent and reviewer has to know the idioms.
- **Version timing.** Adopting v3 now means a v3→v4 migration later (the [migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md) covers renamed services, `Cause`, `catch*` and Schema). Adopting v4 now means an RC, "unstable" http/schema modules, and a broken Superforms adapter.
- **Two ways to fail.** A partial adoption leaves Promise code and Effect code side by side, with conversions at every seam: Better Auth hooks, Hono handlers, SvelteKit actions.

### Recommendation: **skip for now**

- Record an ADR in the same shape as ADR-0016 ("not adopted now").
- Revisit when **all** of these hold:
  - Effect 4.0 is published as `latest`.
  - Superforms ships a v4-compatible adapter, or `packages/types` moves to Standard Schema.
  - A concrete need appears that Promises handle badly, for example R2 upload pipelines with retries, bulk imports or exports on Workers (ADR-0003's heavy-endpoint note), or fan-out with concurrency limits.
- If a spike is wanted before that, the smallest one is wrapping `sendEmail` (`apps/api/src/email.ts:65-81`) with retry, timeout and a tagged `EmailSendError`, run via `Effect.runPromise` at the Better Auth callback. Keep Zod, Hono RPC and the store untouched. Measure the bundle delta with `wrangler deploy --dry-run` and CPU with `wrangler tail` on a named Worker (previews emit no logs, ADR-0019).
- Do not pilot in `packages/db/src/import/*`. It is a one-off cutover tool, so the learning wouldn't carry over.

---

## 3. Alchemy

### What it is, version and maturity

- "**Infrastructure-as-Effects** — cloud infrastructure and application logic as a single, type-safe Effect program" ([README](https://github.com/alchemy-run/alchemy)). The README also says: "**alchemy** is in alpha. Expect breaking changes."
- **Current: `alchemy@2.0.0-beta.79`.** It is the npm `latest` dist-tag even though it is a beta; `next` points at the older beta.72. GitHub releases run up to `v2.0.0-beta.79` (2026-09-18). The v2 betas started 2026-04-13. The last non-prerelease is the v1 line's `0.94.0` (2026-08-01), documented at `v1.alchemy.run` ([migrating from v1](https://alchemy.run/migrating-from-v1)). The repo has about 1.4k stars.
- **Its peer dependencies bring in Effect 4.** v2's peers include **`effect: ">=4.0.0-rc.115 || >=4.0.0"` (required, not optional)** and an optional `drizzle-orm: 1.0.0-rc.5-ab785fc`. Unpacked size is about 93 MB (npm). Worker code itself does not have to be Effect: "A Worker doesn't have to be an Effect program. Point `main` at a plain module, a classic `async fetch` handler…", and it is bundled with rolldown ([Workers](https://alchemy.run/cloudflare/compute/workers)).
- **Cloudflare coverage** includes:
  - Workers, R2, D1, KV, Queues, Hyperdrive, Secrets Store and custom domains ([Cloudflare](https://alchemy.run/cloudflare)).
  - `Cloudflare.Pages.Project`/`Deployment`/`Domain`, including branch previews ([Pages reference](https://alchemy.run/providers/cloudflare/pages)).
  - A `Cloudflare.Website.SvelteKit` resource that deploys to **Workers static assets, not Pages**, and "replac[es] any adapter you declare" ([SvelteKit](https://alchemy.run/cloudflare/frontend/sveltekit)).
- **Neon coverage.** Branches, migrations and per-PR preview branches ([Neon](https://alchemy.run/neon)). GitHub: Actions secrets and variables, webhooks, and a `GitHub.Comment` resource for PR comments ([GitHub](https://alchemy.run/github), [CI](https://alchemy.run/environments/ci)).
- **State.** Stored in `.alchemy/` on local disk by default, or in a Cloudflare state-store Worker backed by a Durable Object "with the auth token and encryption key kept in your account's Secrets Store" ([state store](https://alchemy.run/state-store)).

### Fit with this stack, and ADR conflicts

- **ADR-0009 (Cloudflare only).** No conflict in principle. But the ergonomic SvelteKit path moves `apps/web` from **Pages to Workers**. That contradicts `docs/ARCHITECTURE.md` §7 and would drop the `@sveltejs/adapter-cloudflare` setup. You can stay on Pages through `Cloudflare.Pages.Deployment`, but that is the lower-level path.
- **ADR-0019, 0029, 0030, 0020 (the preview pipeline).** A rewrite, not an add-on.
  - Alchemy's model is a stage per PR (`pr-<n>`), `alchemy deploy`, and `alchemy destroy --stage pr-<n>` on close ([CI](https://alchemy.run/environments/ci)).
  - Worker previews are "a named copy of a Worker… It is **not** a Worker version" ([previews](https://alchemy.run/cloudflare/compute/previews)). That is a different mechanism from the repo's `wrangler versions upload --preview-alias` (`preview.yml:653-675`) and its version-count instrumentation (#152).
  - Every behaviour the repo has measured and recorded would have to be re-expressed and re-verified: the title-derived aliases and in-place Neon renames (ADR-0029), Pages pruning with `force=true` (#68, #84), GitHub deployment and environment registration (#154), the schema-diff comment (#153), and the Dependabot and fork guards.
- **ADR-0024 (custom replay migrator).** Conflicts if Alchemy's migrations are enabled. Alchemy applies migrations "as part of every deploy", tracked in `__alchemy_migrations`. It says "a database previously migrated with drizzle-kit or Prisma is adopted automatically: its old tracking table's history is copied in once and the old table is **frozen**" ([Neon migrations](https://alchemy.run/neon/data/migrations)). That would take over the `drizzle.__drizzle_migrations` journal the repo's migrator and import pipeline write. Keep migrations out of Alchemy.
- **Neon preview pattern.** The docs assume "one long-lived project owned by a `staging` stage", which PR stages reference with `Neon.Project.ref()` ([preview branches](https://alchemy.run/neon/guides/preview-branches)). VMB's parent is the `production` branch of a project Alchemy doesn't own. Taking it over means `--adopt`, which "says 'yes, take it over'" ([adopting](https://alchemy.run/cli/adopting-resources)). An alpha IaC tool would then hold the production database project, which is a large blast radius. The Drizzle and Neon guides also lean on Hyperdrive, which conflicts with ADR-0016.
- **ADR-0011 and ADR-0019 (secrets).** Alchemy reads secrets through `effect/Config` and `Config.Redacted` ([secrets](https://alchemy.run/environments/secrets)). fnox could still feed it through `fnox exec`, but the per-version `--secrets-file` flow would change.
- **ADR-0010 (mise).** No conflict. It runs under Node; the CI docs show pnpm with Node 24.

### Where it would help

- It would replace the imperative parts of `scripts/setup-deploy.sh` (GitHub secrets, the Pages project, Worker secrets) with declared, drift-detectable resources ([drift](https://alchemy.run/cli/drift)).
- It could declare the upcoming **R2 bucket** (ADR-0013) and its binding next to the Worker.
- It could shrink `preview.yml` and `cleanup.yml` plus the shell modules into a stage program with typed bindings. But the repo's scripts already encode many hard-won, measured edge cases that Alchemy would need to reproduce.

### Costs and risks

- Alpha and beta churn ("Expect breaking changes").
- It forces Effect 4 RC into the dependency tree.
- The state store is new critical infrastructure. Losing or corrupting it complicates reconciliation, though owned resources are recovered automatically ([adopting](https://alchemy.run/cli/adopting-resources)).
- Lock-in: the infra definition becomes an Effect program.
- Migration effort: roughly 2,000 lines of preview/cleanup YAML and shell, plus the ADR prose that justifies each behaviour.
- The gain is concentrated in one-time provisioning, which is already done.
- If previews are separate Worker scripts, they count against the Free plan's 100-Workers-per-account limit ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).

### Recommendation: **skip**

- When R2 lands, provision it with wrangler (an `[[r2_buckets]]` binding plus `wrangler r2 bucket create`, added as a stage in `setup-deploy.sh`), so ADR-0009 and ADR-0019 stay intact.
- Re-evaluate only when **both** hold: Alchemy 2.0 is GA (a non-prerelease `latest`), and the preview scripts become a real maintenance burden (a new resource type per PR, say, or a second deploy target).
- Even then, spike it in a scratch Cloudflare account. Manage only the R2 bucket plus a plain async Worker, with Alchemy's migrations off and no Neon adoption.

---

## 4. Comparison

| Dimension            | Knip               | Effect                                                                                        | Alchemy                                                                                                        |
| -------------------- | ------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Version (2026-09-29) | 6.38.0 stable      | 3.22.2 stable; 4.0.0-rc.118                                                                   | 2.0.0-beta.79 ("alpha"); v1 line 0.94.0                                                                        |
| Runtime impact       | None (devDep)      | ~6–15 KB gz per the v4 docs; Workers CPU unmeasured                                           | None at runtime; deploy-time tooling (~93 MB unpacked)                                                         |
| ADR conflicts        | None               | 0007 (Superforms adapter is v3-only), 0004 (if HttpApi/Rpc), 0002/0016 (Effect-SQL needs TCP) | 0019/0029/0030 (preview rewrite), 0024 (migrations), 0016 (Hyperdrive guides), Pages→Workers (ARCHITECTURE §7) |
| Effort               | Hours              | Weeks, and it spreads through the code                                                        | Weeks; rewrite and re-verify the preview pipeline                                                              |
| Payoff here          | Immediate, ongoing | Real but modest at this size                                                                  | Mostly one-time provisioning, already done                                                                     |
| Verdict              | **Adopt**          | **Skip now** (revisit after v4 stable)                                                        | **Skip** (revisit after v2 GA)                                                                                 |

**Suggested order:**

1. Knip now.
2. Effect only if its revisit triggers fire. Whatever happens, decide Effect **before** Alchemy, because Alchemy v2 brings Effect 4 in with it.
3. Alchemy last, if ever, and only after Effect is an accepted dependency.

## 5. ADRs to write (docs/adr/template.md)

- **ADR-0037: Knip for unused files, dependencies and exports.** Records the CI step and where it runs (Verify, every actor), the ignore policy for shadcn registry copies, and that `--fix` stays local.
- **ADR-0038: Effect not adopted now.** Same shape as ADR-0016. Records the Superforms/v4 conflict, the Drizzle/TCP conflict, and the revisit triggers above.
- **Alchemy.** Optional ADR-0039 "Alchemy not adopted; wrangler and scripts remain the provisioning path", or a note in ADR-0019. An adoption later would supersede parts of ADR-0019, ADR-0029, ADR-0011 (secrets) and ARCHITECTURE §7 (Pages), and would need its own ADR on state-store ownership.

## 6. Not verified

- **Knip's real output on this repo.** It needs `pnpm install`, which the brief's read-only rule excluded. The findings in §1 are hand spot-checks.
- **Effect's CPU cost per request on Workers.** No primary source; it would have to be measured.
- **Whether Alchemy's Pages `Deployment` resource handles branch aliases and deployment pruning** the way `scripts/pages-preview-deployments.sh` does. The reference page lists the resources but not pruning behaviour.
