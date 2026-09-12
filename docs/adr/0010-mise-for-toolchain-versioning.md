# ADR-0010: Toolchain versioning — mise

**Context:** Monorepo with two apps (`apps/web`, `apps/api`) that need identical Node and pnpm versions across every contributor's machine and CI, without falling back to ad hoc `.nvmrc`/`engines` conventions that drift silently.

**Options considered:**
- nvm
- Volta
- asdf
- mise

**Decision:** mise.

**Trade-offs:** nvm only manages Node and needs manual `nvm use` per shell; Volta is Node/JS-only and less actively developed; asdf is more general but slower and plugin-fragile. mise covers Node + pnpm (and any future CLI, e.g. `wrangler`) from one `.mise.toml`, auto-activates per directory, and has a first-party GitHub Action (`jdx/mise-action`) for CI parity. Cloudflare Pages' own build step doesn't read `.mise.toml` — its dashboard `NODE_VERSION` still needs to be set to match by hand, which is a minor manual sync point, not a blocker.
