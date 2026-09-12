# ADR-0011: Local/CI secrets — fnox

**Context:** Dev-time secrets (Neon connection string, third-party API keys) are currently shared ad hoc between the small internal team via `.env` copy-paste. Production secrets for the deployed Worker are separately handled by `wrangler secret` / the Cloudflare dashboard and are out of scope here.

**Options considered:**
- Plain `.env` files shared manually
- Hosted vault (1Password, HashiCorp Vault)
- sops + age
- fnox

**Decision:** fnox, for local development and CI secrets only. Encrypt with `age`, commit the encrypted file, decrypt via `fnox exec` locally and in CI (age private key stored as a GitHub Actions secret). Production Worker secrets stay in `wrangler secret` / the Cloudflare dashboard as the sole source of truth — fnox is not used to inject secrets at Worker runtime.

**Trade-offs:** fnox is new (same maintainer as mise, built to pair with it) and not yet battle-tested, so it's scoped to dev/CI convenience rather than production credentials, where the blast radius of a bug matters more. A hosted vault would be more mature but is unnecessary infrastructure for a small internal team's dev secrets. Gain: no more manual `.env` sharing, an auditable encrypted file in git, and one CLI ecosystem shared with mise.
