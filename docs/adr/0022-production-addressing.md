# ADR-0022: Production addressing — web on vmblogistics.id, API on api.vmblogistics.id

**Context:** Production addressed the app only at Cloudflare's default hosts (`vmb-web.pages.dev`, `vmb-api.<account>.workers.dev`). Two problems. Email first: Resend's sandbox sender `onboarding@resend.dev` only delivers to the address on the Resend account itself, so production signup/verification email could not work at all until a domain was verified. Second, a demo-facing URL that is visibly a Cloudflare-generated host. A production domain with a verified Resend sender resolves both.

**Options considered:**

- Stay on `*.pages.dev` / `*.workers.dev` and keep the Resend sandbox — rejected: signup email can never reach a user who is not the Resend account owner.
- Rename the Cloudflare resources to shorten the URLs (`vmb-web`/`vmb-api` → `web`/`api`, and the account `workers.dev` subdomain to `vmb`, giving `vmb.pages.dev` / `api.vmb.workers.dev`) — rejected, see below.
- Serve the app on a custom domain (`vmblogistics.id` + `api.vmblogistics.id`) verified in Resend — chosen.

**Decision:** One registrable domain owns every production origin:

| Hostname                 | Owner                                                     |
| ------------------------ | --------------------------------------------------------- |
| `vmblogistics.id` (apex) | `vmb-web` Pages project                                   |
| `api.vmblogistics.id`    | `vmb-api` Worker (declarative `[[routes]]` custom domain) |
| `www.vmblogistics.id`    | 301 redirect to the apex (zone Single Redirect rule)      |

`vmblogistics.id` is verified in Resend and `EMAIL_FROM` is `noreply@vmblogistics.id`. The apex is attached to the Pages project through the Pages API — Pages custom domains are not a `wrangler.toml` setting — while the API binds its hostname declaratively in `apps/api/wrangler.toml`. Each hostname has exactly one owner: a hostname cannot belong to both Pages and a Worker, and Worker custom domains are exact-host only. `BETTER_AUTH_URL` is `https://api.vmblogistics.id` and `WEB_URL` is `https://vmblogistics.id`; the two are same-site (same registrable domain) though cross-origin, so `SameSite=Lax` cookies keep working without a cookie-domain change. `scripts/setup-deploy.sh` derives those URLs from the custom domain when the zone is active in the account, falling back to the default hosts otherwise; `scripts/rotate-fnox-age-key.sh` reuses whatever `setup-deploy.sh` wrote and defaults to the custom domain when there is nothing to reuse.

**Routes are an inheritable key.** `routes` is on wrangler's inheritable-keys list (workers-sdk #13925): a top-level `[[routes]]` custom domain is inherited by an `env.<name>` block that does not override it, and `wrangler deploy --env <name>` then reassigns that custom domain from the production Worker to the env Worker. `apps/api/wrangler.toml` therefore sets `routes = []` in `[env.staging]` to break the inheritance. (The original issue text asserted wrangler does _not_ inherit top-level routes; that reflected the legacy v1 docs and is wrong for current wrangler.)

**Rejected: renaming the resources.** Both renames were considered and are rejected, not deferred.

- _Renaming the account's `workers.dev` subdomain_ (`muhammad-rizal` → `vmb`). It changes every Worker URL in the account at once, and Cloudflare documents no frequency limit while the community reports `error 10036` requiring a support ticket. It buys nothing once the custom domain is live — preview URLs resolve the subdomain from the API at runtime rather than from a repo constant — and `dev` specifically reads like a broken TLD in every URL.
- _Renaming `vmb-web`/`vmb-api` → `web`/`api`._ A Worker `name` change creates a new Worker and orphans the old one: secrets, custom domains, routes, and version history do not transfer. A Pages project cannot be renamed at all — Cloudflare's guidance is to delete and recreate, redoing custom domains, previews, and the Git integration. And `*.pages.dev` is a global namespace shared across all accounts, so a short name like `web` is not reliably available. `vmb-web`/`vmb-api` also read better in dashboard listings, `wrangler tail`, and analytics, where a bare `web`/`api` becomes ambiguous as soon as a second product exists.

**Trade-offs:** The custom domain adds a human provisioning step (registrar, nameservers, zone activation) the default hosts did not need, and in-flight verification links issued under an old origin stop working; the old `*.pages.dev`/`*.workers.dev` production URLs cannot be redirected, since they live in different zones. Preview deployments deliberately stay on `*.pages.dev`/`*.workers.dev` (ADR-0019): they are short-lived and per-PR, so attaching the custom domain to them buys nothing. In return, production email works for any recipient, the public origins are stable and brand-owned, and the Cloudflare resource names become an internal detail nobody has to say aloud. The free plan is sufficient — custom domains and Advanced Certificates are included.
