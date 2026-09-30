# ADR-0039: Alchemy — not adopted; wrangler and scripts stay the provisioning path

**Context:** Alchemy was proposed as TypeScript infrastructure-as-code for Cloudflare and Neon, to replace the imperative provisioning: `scripts/setup-deploy.sh`, the per-PR preview pipeline (`preview.yml`, `cleanup.yml` and the `scripts/*.sh` modules, about 2,000 lines) and the R2 bucket still to come (ADR-0013). Checked on 2026-09-29, the current release is `alchemy@2.0.0-beta.79`, and its README says "alpha. Expect breaking changes". v2 requires `effect` 4 as a peer dependency, and Effect is not adopted (ADR-0038). Research: `docs/research/effect-knip-alchemy.md` §3.

**Options considered:**

- Adopt Alchemy v2 for all provisioning and previews — rejected:
  - ADR-0019, ADR-0029 and ADR-0030: it models a preview as a stage per PR, and a Worker preview as a named copy of the Worker rather than a version upload with a preview alias. Title-derived aliases, in-place Neon branch renames, Pages pruning, GitHub deployment registration, the schema-diff comment and the Dependabot and fork guards would all have to be rebuilt and re-verified.
  - ADR-0024: its migrations run on every deploy, and it takes over and freezes an existing drizzle-kit migration table. That is the journal the repo's own migrator writes.
  - Its per-PR Neon pattern expects to own the Neon project, which means adopting the production project into an alpha tool.
  - Its SvelteKit resource deploys to Workers static assets, not Pages (ARCHITECTURE §7).
- Adopt it only for new resources, such as the R2 bucket — rejected for now: it still brings in Effect 4 RC and a new state store for one bucket that wrangler can create.
- Don't adopt it; keep wrangler, GitHub Actions and the setup wizard — chosen.

**Decision:** Not adopted. When R2 lands, provision it with wrangler: an `[[r2_buckets]]` binding in `apps/api/wrangler.toml` plus `wrangler r2 bucket create`, added as a step in `setup-deploy.sh`. Revisit only when both hold: Alchemy 2.0 is GA (a non-prerelease npm `latest`), and the preview scripts become a real maintenance burden, such as a new resource type per PR or a second deploy target. Even then, spike it in a scratch Cloudflare account, managing only an R2 bucket and a plain Worker, with Alchemy's migrations off and no Neon adoption.

**Trade-offs:** Provisioning stays imperative. Nothing detects drift, and `setup-deploy.sh` stays a wizard rather than declared resources. In return, the preview pipeline keeps its measured, documented behaviour, the production Neon project stays out of an alpha tool's state, and no Effect 4 RC enters the dependency tree. Adopting Alchemy later would supersede parts of ADR-0019, ADR-0029, ADR-0011 (secrets) and ARCHITECTURE §7, and would need its own ADR on who owns the state store.
