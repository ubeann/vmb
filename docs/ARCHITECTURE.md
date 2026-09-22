# VMB — Architecture & Tech Stack

> Internal project/admin management tool. Migrated from Laravel + Filament to a modern, edge-first stack optimized for free-tier hosting given the small internal user base.

## 1. Overview

VMB is being rebuilt from a monolithic Laravel + Filament application into a decoupled frontend/backend architecture, deployed entirely on Cloudflare's platform to maximize free-tier usage while keeping operational complexity low.

**Goals:**

- Replace Laravel/Filament admin panel with a modern, faster frontend
- Move database from self-managed Postgres to Neon (serverless Postgres)
- Keep hosting costs at $0 given small internal user count
- Reduce operational surface area (single hosting platform, minimal moving parts)

## 2. Tech Stack Summary

| Layer                        | Technology                                                  | Notes                                                                                                                |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Database                     | [Neon](https://neon.tech) (Postgres)                        | Serverless Postgres, autosuspend on idle                                                                             |
| ORM                          | [Drizzle ORM](https://orm.drizzle.team)                     | Edge-runtime compatible, no binary engine                                                                            |
| Backend API                  | [Hono](https://hono.dev)                                    | Deployed on Cloudflare Workers                                                                                       |
| API type-safety              | Hono RPC (`hono/client`)                                    | Types inferred directly from routes — no separate tRPC layer needed                                                  |
| Frontend                     | **SvelteKit**                                               | Deployed on Cloudflare Pages                                                                                         |
| Server-state / data fetching | [TanStack Query (Svelte Query)](https://tanstack.com/query) | Caching, refetching, optimistic updates for CRUD-heavy screens                                                       |
| Forms                        | [Superforms](https://superforms.rocks)                      | SvelteKit-idiomatic form handling, progressive enhancement, server-side validation                                   |
| Validation                   | [Zod](https://zod.dev)                                      | Shared schemas between backend validation and frontend forms                                                         |
| File Storage                 | Cloudflare R2                                               | Needed — legacy `FileUpload` usage is broad (ADR-0013)                                                               |
| Background jobs              | Cloudflare Queues _(not for MVP)_                           | Not needed yet — legacy queue is configured but unused (ADR-0014)                                                    |
| Auth                         | Better Auth (self-hosted, on `apps/api`)                    | Decided (ADR-0012)                                                                                                   |
| Monorepo tooling             | Turborepo                                                   | Build orchestration + remote caching                                                                                 |
| Remote cache                 | Vercel remote cache (`TURBO_TOKEN`/`TURBO_TEAM` in CI)      | Free, used for CI/dev speed only — not hosting                                                                       |
| CI/CD                        | GitHub Actions + `wrangler deploy`                          | Deploys to Cloudflare Workers/Pages                                                                                  |
| Toolchain versioning         | [mise](https://mise.jdx.dev)                                | Pins Node/pnpm (and other CLIs) via `.mise.toml`, shared by local dev and CI                                         |
| Dev/CI secrets               | [fnox](https://github.com/jdx/fnox)                         | Age-encrypted secrets committed to repo for local dev + CI only; production Worker secrets stay in `wrangler secret` |

## 3. High-Level Architecture

```
                        ┌─────────────────────────┐
                        │        End Users          │
                        │   (internal, small team)   │
                        └────────────┬─────────────┘
                                     │ HTTPS
                                     ▼
                     ┌───────────────────────────────┐
                     │      Cloudflare Pages           │
                     │   SvelteKit / Next.js frontend  │
                     └────────────────┬───────────────┘
                                      │ REST / RPC calls
                                      ▼
                     ┌───────────────────────────────┐
                     │      Cloudflare Workers          │
                     │        Hono API backend          │
                     │  (auth, business logic, routes)  │
                     └────────────────┬───────────────┘
                                      │ SQL (via Drizzle)
                                      ▼
                     ┌───────────────────────────────┐
                     │           Neon Postgres           │
                     │     (serverless, autosuspend)     │
                     └───────────────────────────────┘

              (optional, if file uploads exist)
                     ┌───────────────────────────────┐
                     │          Cloudflare R2             │
                     │        Object storage              │
                     └───────────────────────────────┘
```

## 4. Repository Structure (Turborepo Monorepo)

```
vmb/
├── apps/
│   ├── web/              # SvelteKit frontend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── api.ts        # Hono RPC client (hc<AppType>)
│   │   │   │   └── queries/       # TanStack Query hooks per resource
│   │   │   └── routes/
│   │   ├── wrangler.toml # Cloudflare Pages config
│   │   └── package.json
│   └── api/               # Hono backend
│       ├── src/
│       │   ├── routes/
│       │   ├── middleware/
│       │   └── index.ts   # exports AppType for RPC inference
│       ├── wrangler.toml # Cloudflare Workers config
│       └── package.json
├── packages/
│   ├── db/                 # Drizzle schema + Neon client
│   │   ├── schema/          # one module per Postgres schema, plus auth
│   │   └── client.ts
│   ├── types/               # Shared Zod schemas + inferred TS types (web + api)
│   └── config/               # Shared eslint/tsconfig/prettier
├── turbo.json
├── package.json
└── pnpm-workspace.yaml       # (or yarn/npm workspaces)
```

## 5. Data Layer

- **Database:** Neon Postgres, one project. `production` is the only long-lived branch: every pull request gets a throwaway preview branch and every developer a throwaway local branch (`scripts/dev-db.sh`), so there is no standing dev or staging environment to keep at head (ADR-0019, ADR-0028, ADR-0029). The application database is named `app` on every branch, so a connection string differs between environments only by host (ADR-0029).
- **Session timezone:** the application database (`app`) _declares_ `timezone = 'UTC'` on production, so a query that renders a timestamp without naming a zone produces the same text in any fresh session; every other branch is forked from `production` and inherits the declaration, so previews and each developer's local branch agree (ADR-0019, ADR-0029). The app itself renders in the reader's zone (#115). Configuration, not schema — see ADR-0027.
- **ORM:** Drizzle, chosen over Prisma because it has no native binary engine — required for compatibility with the Cloudflare Workers edge runtime.
- **Cold starts:** Neon's free tier autosuspends compute after inactivity. Expect 1–3s latency on the first query after idle. Acceptable for an internal tool with sporadic usage; document this for end users if it comes up.
- **Migrations:** managed via Drizzle Kit, run as part of CI/CD pipeline or manually before deploy.

## 6. Backend (Hono on Cloudflare Workers)

- Hono chosen for its native fit with the Workers runtime (built for it, minimal cold-start overhead).
- Structure: routes organized by resource/domain, with middleware for auth, request validation, and error handling.
- **Free tier constraints to design around:**
  - 100,000 requests/day (Workers Free)
  - 10ms CPU time per request (wall-clock/I/O wait doesn't count, but heavy in-request computation does)
  - 64MiB bundle size limit (recently raised, generous for this project size)
- Any endpoint requiring heavy computation (e.g., large report generation, bulk exports) should be flagged for review — may need to be split into a background job or moved to a Node-runtime function elsewhere if it risks exceeding the CPU limit.

## 7. Frontend (Cloudflare Pages)

- Framework: **SvelteKit** (final decision).
- Deployed as static assets + Pages Functions where SSR/dynamic routes are needed.
- Pages Functions share the same Workers free-tier request/CPU budget — factor this into total request planning alongside the API.

### 7.1 API Type-Safety: Hono RPC (not tRPC)

Rather than adding tRPC as a separate RPC layer, the frontend consumes the backend directly via **Hono's built-in RPC client** (`hono/client`), which infers request/response types straight from the Hono route definitions.

- Avoids running two RPC abstractions (Hono + tRPC) on top of one HTTP layer.
- Shared types live in `packages/types`, imported by both `apps/api` (for validation) and `apps/web` (for the typed client).
- Example pattern:
  ```ts
  // apps/api/src/index.ts
  const app = new Hono().get('/projects', ...).post('/projects', ...)
  export type AppType = typeof app

  // apps/web/src/lib/api.ts
  import type { AppType } from '@vmb/api'
  import { hc } from 'hono/client'
  export const client = hc<AppType>(API_URL)
  ```

### 7.2 Data Fetching: TanStack Query (Svelte Query)

- Wraps the typed Hono client calls in `createQuery` / `createMutation` for caching, refetching, and optimistic UI updates — important for a CRUD-heavy admin panel with lots of list/detail/edit screens.
- Keeps server-state (API data) cleanly separated from local UI state.

### 7.3 Forms & Validation

- **Superforms** for form state, progressive enhancement, and server-side validation — SvelteKit-idiomatic rather than porting over React form patterns.
- **Zod** schemas shared between backend request validation and frontend form validation, defined once in `packages/types`.

## 8. Auth

- **Decided: Better Auth**, self-hosted, mounted directly in the `apps/api` Hono Worker and backed by `packages/db` — see ADR-0012. No external auth vendor or MAU ceiling; trades that for owning the login/signup UI and a known, accepted risk around Workers free-tier CPU time for password hashing (measure-then-migrate plan in ADR-0012).
- Session/token integration strategy (Better Auth session verification in the Hono API + SvelteKit `hooks.server.ts`) is left for the auth implementation ticket, not this scaffold.

## 9. Deployment & CI/CD

- Turborepo orchestrates the workspace's `build`, `test`, `lint` and `typecheck` tasks across `apps/web` and `apps/api`, with task caching via Vercel's free remote cache. Only `apps/web` has a build artifact; `apps/api` is bundled by `wrangler deploy` from source, and `typecheck` is what checks it. CI authenticates the cache with the `TURBO_TOKEN`/`TURBO_TEAM` repo secrets; `build` declares `PUBLIC_API_URL` as an env input so preview and production builds keep distinct cache keys. Used purely for build speed, not hosting.
- Each app has its own deploy script:
  - `apps/api`: `wrangler deploy`
  - `apps/web`: `wrangler pages deploy` (or framework-specific Cloudflare adapter build)
- GitHub Actions (or equivalent) runs `turbo build` then deploy scripts on merge to `master`.
- Per-PR preview deployments (ADR-0019): each same-repo PR gets an isolated `apps/api` Worker version, an `apps/web` Pages deployment pruned to the newest on each push, a Neon branch carrying the `app` database, and a GitHub deployment registered under the `preview/pr-<N>` environment for the timeline's "View deployment" button. The Neon branch, the Pages deployments and the environment are torn down on close (the deployment records remain as history); a PR from a fork carries no repository secrets, so Preview and Cleanup skip it instead of failing (ADR-0030). The preview alias is slugged from the PR title — the branch name is the fallback — so a preview URL describes the PR rather than the branch its author's tooling minted (ADR-0029). The sticky comment reports the URLs and a bounded schema diff between the preview branch and `production` — a diff that cannot be computed is reported as unavailable rather than failing the preview (issue #153). Replaces the standing staging environment as the dry-run mechanism.
- Node/pnpm versions are pinned via `mise` (`.mise.toml`) and installed in CI via `jdx/mise-action`, so local and CI toolchains match exactly. Cloudflare Pages' own build environment doesn't read `.mise.toml`, so its dashboard `NODE_VERSION` is set manually to stay in sync.
- The one tool CI does not pin is the browser `apps/web`'s component tests run in: CI drives the runner image's preinstalled Chrome (`channel: "chrome"` when `CI` is set), which is already on the image and needs no download or OS-dependency install — 23 s of every run. Local runs keep the Chromium `pnpm-lock.yaml` pins. The deliberate cost is that CI tests whichever Chrome version the runner image ships.
- Workflow action versions are kept current by Dependabot (`.github/dependabot.yml`, grouped weekly for `github-actions` and for npm minor/patch), so an action's runtime deprecation is fixed by a PR rather than noticed only once GitHub force-runs the old one.
- Dependabot runs receive no Actions secrets, so Dependabot-authored PRs take a secret-free path (ADR-0020): `ci.yml` runs build/test/lint/typecheck without `fnox exec`, and `preview.yml`/`cleanup.yml` skip their environment jobs outright. The repo-wide `Format` check runs in its own step for every actor, before that split (ADR-0023). Withholding `FNOX_AGE_KEY` and `CLOUDFLARE_API_TOKEN` from a run that builds freshly-bumped dependencies is deliberate; human PRs keep the full secret path.
- Local and CI dev secrets (shared values such as `BETTER_AUTH_SECRET`) are managed with `fnox`, age-encrypted and committed to the repo; decrypted via `fnox exec` locally and in CI using an age key stored as a GitHub Actions secret. Values that are per-developer rather than shared — the local development branch's `DATABASE_URL`, the Neon API key `scripts/dev-db.sh` needs — live in the gitignored `fnox.local.toml` overlay, which fnox merges over the committed store (ADR-0029). Production Worker secrets remain in `wrangler secret` / the Cloudflare dashboard, not fnox — ephemeral preview versions are the one exception (ADR-0019).

## 10. Migration Plan (from Laravel/Filament)

1. Stand up Hono + Drizzle against Neon, replicating existing Filament CRUD/API surface as REST or RPC endpoints. Validate against current data before touching the frontend.
2. Build the new frontend incrementally against the new API, page by page, keeping the Laravel app live as fallback until feature parity is reached.
3. Migrate auth and permissions last — highest risk area for Filament-specific quirks (roles, policies, guards).
4. Cut over DNS/access only once parity is verified.

## 11. Open Decisions

- [x] Frontend framework: **SvelteKit** (decided)
- [x] API type-safety approach: **Hono RPC**, not tRPC (decided)
- [x] Data fetching: **TanStack Query** (decided)
- [x] Forms/validation: **Superforms + Zod** (decided)
- [x] Toolchain versioning: **mise** (decided)
- [x] Dev/CI secrets management: **fnox** (decided)
- [x] Auth provider: **Better Auth** (self-hosted) — decided (ADR-0012)
- [x] File storage: **R2 is needed** — decided (ADR-0013)
- [x] Cloudflare Queues: **not needed for MVP** — decided (ADR-0014)
- [x] Staging environment strategy: separate Neon branch + separate Workers/Pages environment (ADR-0015), now largely superseded by **per-PR preview deployments** (ADR-0019). Pages allows only `preview`/`production`, so the Pages `[env.staging]` was invalid and removed; the `apps/api` `[env.staging]` remains, unprovisioned, pending an explicit decision.

See `DECISIONS.md` for the rationale behind each finalized choice.

---

_Last updated: 2026-09-22 (§5: `app` on every environment branch, per-developer local branches; §9: preview aliases named for their PR, fork PRs skip Preview and Cleanup, the web preview registered as a GitHub deployment, and the preview comment's bounded schema diff, per ADR-0029/ADR-0030, ADR-0019 and issue #153)_
