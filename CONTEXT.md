# CONTEXT

Shared language and canonical facts for this repo. It grows lazily — a term or
fact is added when it is resolved, not speculatively. See `docs/agents/domain.md`
for how the engineering skills consume this file, and `docs/adr/` for the
decisions behind it.

## Canonical origins

Recorded by ADR-0022. These are the production origins; everything else is a
preview or an internal host.

| Origin                                                                                            | What it is                                                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `https://vmblogistics.id`                                                                         | Production web app — the `vmb-web` Pages project serves the apex    |
| `https://api.vmblogistics.id`                                                                     | Production API — the `vmb-api` Worker                               |
| `https://www.vmblogistics.id`                                                                     | 301 redirect to the apex                                            |
| `https://vmb-web.pages.dev`                                                                       | Web origin, used only as a fallback before the custom domain exists |
| `https://vmb-api.<account>.workers.dev`                                                           | API origin, used only as a fallback before the custom domain exists |
| `https://pr<N>-<slug>.vmb-web.pages.dev` and `https://pr<N>-<slug>-vmb-api.<account>.workers.dev` | Per-PR preview deployments (ADR-0019) — never production            |

`BETTER_AUTH_URL` is the API origin and `WEB_URL` is the web origin; both are
derived from these values by `scripts/setup-deploy.sh`.

## Glossary

- **legacy** / **`vmb-warehouse`** — the Laravel + Filament app this project is rebuilding. Until a module reaches parity it is the source of truth for business logic, data shape, and permissions (`docs/agents/legacy-reference.md`).
- **preview** — the ephemeral per-PR environment: an API Worker version, a Pages deployment, and an isolated Neon branch (ADR-0019). Not staging.
- **production** — the `vmb-api` Worker and `vmb-web` Pages project serving the canonical origins above.
- **staging** — the `vmb-api-staging` Worker's `[env.staging]` config. Present but unprovisioned; whether it earns its keep is still open (ADR-0019, issue #21). Not a preview.
