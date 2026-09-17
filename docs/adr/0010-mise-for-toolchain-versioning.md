# ADR-0010: Toolchain versioning — mise

**Context:** Monorepo with two apps (`apps/web`, `apps/api`) that need identical Node and pnpm versions across every contributor's machine and CI, without falling back to ad hoc `.nvmrc`/`engines` conventions that drift silently.

**Options considered:**

- nvm
- Volta
- asdf
- mise

**Decision:** mise.

**Trade-offs:** nvm only manages Node and needs manual `nvm use` per shell; Volta is Node/JS-only and less actively developed; asdf is more general but slower and plugin-fragile. mise covers Node + pnpm (and any future CLI, e.g. `wrangler`) from one `.mise.toml`, auto-activates per directory, and has a first-party GitHub Action (`jdx/mise-action`) for CI parity. Cloudflare Pages' own build step doesn't read `.mise.toml` — its dashboard `NODE_VERSION` still needs to be set to match by hand, which is a minor manual sync point, not a blocker.

---

## Bumping the pins (issue #51)

**Context:** `.mise.toml` pins seven tools — `node`, `pnpm`, `fnox`, `age`, `wrangler`, `actionlint`, `shellcheck` — and nothing bumped them. Dependabot (`.github/dependabot.yml`) covers npm and the Actions, but it has no `mise` ecosystem, so those seven pins drifted silently: nothing noticed a pin falling behind until a stale tool broke CI or the local/CI parity the first half of this ADR set out to guarantee. It had already happened — `fnox 1.25.1` was ten minor releases behind upstream, and a miss like that is invisible until it isn't.

**Options considered:**

- (a) **Renovate** — a native `mise` manager covering all seven tools, and able to take npm and the Actions off Dependabot too. Rejected: its PRs come from a GitHub App, not Dependabot, so GitHub's separate Dependabot secrets store does not apply to them and they receive the repository's Actions secrets — reintroducing exactly the production-credential exposure ADR-0020 closes. It also adds a third-party app to solve a problem a weekly check solves.
- (b) **A scheduled workflow that opens the bump PR itself.** Rejected: a PR created with a workflow's `GITHUB_TOKEN` does not trigger further workflows, so the bump would arrive with no CI signal at all — precisely the failure mode issue #45 was about. Widening it to a PAT or App token to restore the signal puts a long-lived credential back in circulation for a chore.
- (c) **Manual bumps, plus a scheduled drift alarm.** Chosen.

**Decision:** (c). `.github/workflows/toolchain-drift.yml` runs weekly on `master`, calls `mise outdated --local --bump --json`, and opens — or refreshes — a `toolchain-drift` issue listing every pin whose newest upstream release falls outside what the pin allows. When nothing is behind it closes the issue again. The run stays green: the alarm is the issue, not a red X, and a pin being behind is a judgement call rather than a chore — a major bump is a decision. Tools are bumped by editing `.mise.toml` and working the issue's checklist.

`--bump` is what makes the signal mean "the pin is stale" and not "this runner has an old install": it reports a tool only when a release exists _outside_ the pin's range. A ranged pin that already covers the newest release (`node = "26"` while 26.x is current) stays quiet, while an exact pin (`fnox = "1.25.1"`) speaks as soon as a newer release exists. Majors therefore always surface, and patch churn only surfaces for pins deliberately held exact.

Between this alarm and Dependabot, every pinned version in the repo is watched by exactly one of them: Dependabot watches the ecosystems named in `.github/dependabot.yml`, the alarm watches `.mise.toml`.

**Pins that exist in two places.** Three `.mise.toml` entries have a counterpart in `package.json`. The duplication is deliberate, but only once it is spelled out:

- `pnpm = "12"` vs `"packageManager": "pnpm@12.4.1"`. Different jobs: the mise range guarantees a pnpm 12.x on `PATH` so `pnpm` runs at all, while `packageManager` is the exact version that runs — pnpm's default `pmOnFail: download` makes the declared version authoritative, downloading and running 12.4.1 rather than failing when `PATH` holds a different 12.x. `packageManager` is the source of truth for the version and is bumped by hand.
- `node = "26"` vs `"engines": { "node": ">=24" }`. Different claims, not a conflict: `engines` is the floor a consumer of these packages needs; the mise pin is what the repo builds and deploys on. Move `engines` only when the floor genuinely moves.
- `wrangler = "4"` vs `"wrangler": "^4.0.0"` in `apps/*`. Reconciled here. The pin used to be an exact `4.131.1`, which both overstated it and made the alarm noisy: inside a package `pnpm run` puts `apps/*/node_modules/.bin` ahead of the mise shim, so the _devDependency_ is the wrangler that actually deploys, and the exact pin only existed to notify the team of its own patch churn every week. As a range it matches the devDependency's `^4.0.0` — both mean "the 4.x line" — Dependabot maintains the devDependency, and the alarm speaks only when 5.x arrives.

**Trade-offs:** Manual bumps mean a pin stays behind until someone acts on the issue. The alarm turns that from an oversight into a decision, but it does not do the work. A weekly check is silence when it is quiet and one issue when it is not — and it closes its own issue when the drift clears, so an open `toolchain-drift` issue always means something is behind _right now_ rather than "was, once". The comparison is against the pin's range, so it will not report that a ranged pin's newest in-range release moved; that is safe because a ranged pin resolves to the newest match at install time, but it means the "identical versions" promise above still rests on pins being ranges rather than a lock. This repo does not use `mise.lock`, so `node = "26"` can resolve to different 26.x builds on different days; adding one would close that last gap and is deliberately left out of this decision. Renovate stays the option to revisit if manual bumps become the bottleneck — but it should be revisited together with ADR-0020's gating, not around it.
