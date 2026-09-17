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

| Layer | Technology | Notes |
|---|---|---|
| Database | [Neon](https://neon.tech) (Postgres) | Serverless Postgres, autosuspend on idle |
| ORM | [Drizzle ORM](https://orm.drizzle.team) | Edge-runtime compatible, no binary engine |
| Backend API | [Hono](https://hono.dev) | Deployed on Cloudflare Workers |
| API type-safety | Hono RPC (`hono/client`) | Types inferred directly from routes — no separate tRPC layer needed |
| Frontend | **SvelteKit** | Deployed on Cloudflare Pages |
| Server-state / data fetching | [TanStack Query (Svelte Query)](https://tanstack.com/query) | Caching, refetching, optimistic updates for CRUD-heavy screens |
| Forms | [Superforms](https://superforms.rocks) | SvelteKit-idiomatic form handling, progressive enhancement, server-side validation |
| Validation | [Zod](https://zod.dev) | Shared schemas between backend validation and frontend forms |
| File Storage | Cloudflare R2 | Needed — legacy `FileUpload` usage is broad (ADR-0013) |
| Background jobs | Cloudflare Queues *(not for MVP)* | Not needed yet — legacy queue is configured but unused (ADR-0014) |
| Auth | Better Auth (self-hosted, on `apps/api`) | Decided (ADR-0012) |
| Monorepo tooling | Turborepo | Build orchestration + remote caching |
| Remote cache | Vercel remote cache (`TURBO_TOKEN`/`TURBO_TEAM` in CI) | Free, used for CI/dev speed only — not hosting |
| CI/CD | GitHub Actions + `wrangler deploy` | Deploys to Cloudflare Workers/Pages |
| Toolchain versioning | [mise](https://mise.jdx.dev) | Pins Node/pnpm (and other CLIs) via `.mise.toml`, shared by local dev and CI |
| Dev/CI secrets | [fnox](https://github.com/jdx/fnox) | Age-encrypted secrets committed to repo for local dev + CI only; production Worker secrets stay in `wrangler secret` |

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
│   │   ├── schema.ts
│   │   └── client.ts
│   ├── types/               # Shared Zod schemas + inferred TS types (web + api)
│   └── config/               # Shared eslint/tsconfig/prettier
├── turbo.json
├── package.json
└── pnpm-workspace.yaml       # (or yarn/npm workspaces)
```

## 5. Data Layer

- **Database:** Neon Postgres, single project/branch for production; consider a separate Neon branch for staging/dev (Neon supports database branching similar to git branches).
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

- Turborepo orchestrates builds across `apps/web` and `apps/api`, with task caching via Vercel's free remote cache. CI authenticates it with the `TURBO_TOKEN`/`TURBO_TEAM` repo secrets; `build` declares `PUBLIC_API_URL` as an env input so preview and production builds keep distinct cache keys. Used purely for build speed, not hosting.
- Each app has its own deploy script:
  - `apps/api`: `wrangler deploy`
  - `apps/web`: `wrangler pages deploy` (or framework-specific Cloudflare adapter build)
- GitHub Actions (or equivalent) runs `turbo build` then deploy scripts on merge to `master`.
- Per-PR preview deployments (ADR-0019): each PR gets an isolated `apps/api` Worker version, `apps/web` Pages deployment, and Neon branch, torn down on close. Replaces the standing staging environment as the dry-run mechanism.
- Node/pnpm versions are pinned via `mise` (`.mise.toml`) and installed in CI via `jdx/mise-action`, so local and CI toolchains match exactly. Cloudflare Pages' own build environment doesn't read `.mise.toml`, so its dashboard `NODE_VERSION` is set manually to stay in sync.
- Local and CI dev secrets (e.g. Neon connection string) are managed with `fnox`, age-encrypted and committed to the repo; decrypted via `fnox exec` locally and in CI using an age key stored as a GitHub Actions secret. Production Worker secrets remain in `wrangler secret` / the Cloudflare dashboard, not fnox — ephemeral preview versions are the one exception (ADR-0019).

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
*Last updated: 2026-09-17 (§9, §11: per-PR preview deployments, ADR-0019)*