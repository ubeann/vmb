## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo (ubeann/vmb), using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five triage states, plus `complexity:*`, `review:human` and `needs-decision`. See `docs/agents/triage-labels.md`.

### Ticket loop

Building a ticket unattended, gating and merging an agent PR, and the scheduled dispatcher and morning digest. See `docs/agents/ticket-loop.md`.

### Domain docs

Single-context layout: `GLOSSARY.md` at the repo root (created lazily) + `docs/adr/` for decision records. See `docs/agents/domain.md`.

### Git workflow

Branch naming, commit message format and co-author trailer, PR body template, stacking and merge strategy. See `docs/agents/git-workflow.md`.

### Model routing

Picking a model tier for a ticket or delegated task, which review each complexity label gets, running Macroscope, and adopting a new model. See `docs/agents/model-routing.md`.

### Legacy reference

VMB is being migrated from `ubeann/vmb-warehouse` (Laravel + Filament). See `docs/agents/legacy-reference.md` for where it lives and how to use it as a parity reference.

### Agent harnesses

Which harnesses (Claude Code, Antigravity) load these instructions and the skill-driven flows, and the routing constraint that follows. See `docs/agents/harnesses.md`.

### Design workflow

Redesigning a screen's look, or making illustrations, logos or motion for it: the steps, rules and paid tools (Recraft, Pen, Rive) proven on the auth pages. See `docs/agents/design-workflow.md`.

### UI prototype round

Deciding a screen's layout or interaction before it is built: critique, grilling, a throwaway prototype with a stop rule, ADRs, the parity sheet the tickets quote, and the parity audit that closes the milestone. See `docs/agents/ui-prototype-round.md`.

### T3 Code tools

Which T3 Code tools the ticket loop, reviews and page checks rely on, which to adopt next, their gotchas, and how to re-check them after a T3 update. See `docs/agents/t3-code.md`.

### Page checks

Seeing a page you changed: screenshots and Lighthouse runs on a PR preview or local dev, signed in as the seeded preview user. See `docs/agents/page-checks.md`.
