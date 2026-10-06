# Model routing: tiers, reviews, adopting a model

Route work to a **tier** — `fast`, `daily`, or `frontier` — never straight to a model name. The rules below speak only in tiers; the one table that names models is the tier table, so a new model wave is a one-row edit.

## Tiers

| Tier       | Codex                                   | Claude                         | OpenCode                               |
| ---------- | --------------------------------------- | ------------------------------ | -------------------------------------- |
| `fast`     | GPT-6 Luna                              | —                              | DeepSeek V4.1 Flash (OpenCode Go plan) |
| `daily`    | GPT-6.1 Sol                             | Claude Sonnet 5.5              | —                                      |
| `frontier` | GPT-6 Astra (fallback / second opinion) | Claude Opus 5.5 (first choice) | —                                      |

Within a tier, alternate providers by quota and availability. **Gemini has no tier slot** — it is a second-opinion reviewer only (decision in #184), made when Antigravity had no skills and its only picker model was a Flash. Both have since changed (it has the skills, see `harnesses.md`, and T3 now offers Gemini 3.1 Pro), so revisit the slot at the next tier review.

Pricing, benchmarks, and billing behind this table: `docs/research/llm-model-tiering-2026-09.md`. Re-verify the table when that file's review-by date passes **or when a provider is added**, and update both together.

## Which tier, by stage

| Stage                                                                 | Tier                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Planning: `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/wayfinder` | `frontier`, always — a weak spec degrades every ticket built from it |
| Building: `/implement`, `/tdd`                                        | From the ticket's `complexity:*` label (below)                       |
| Subagent legwork: searches, exploration, lookups, mechanical edits    | `fast`                                                               |
| Review: `/code-review`, Macroscope                                    | From the ticket's `complexity:*` label — see [Review](#review)       |

Skill-driven work (`/implement`, `/tdd`, `/code-review`, and the planning flows) goes only to a harness that has the skills — see `harnesses.md`.

## Complexity labels

| Label                 | Criteria                                                                                                                                                  | Tier       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `complexity:trivial`  | Mechanical, no design judgment: typo/doc fixes, dependency/version bumps, single obvious line fixes, boilerplate from an established pattern              | `fast`     |
| `complexity:standard` | The default. Feature work or bug fix following existing patterns or an already-decided design — even across several files                                 | `daily`    |
| `complexity:complex`  | Needs a stated reason: cross-cutting change, security- or data-integrity risk (e.g. rewriting production data), or a new architecture decision still open | `frontier` |

- **Set it once, at creation.** `/to-tickets` sets the label on each ticket it creates (and `/triage` on incoming issues); don't re-pick it by feel at pickup time. Apply it like any other label (`gh issue edit <n> --add-label "complexity:standard"` — see `issue-tracker.md`).
- **`complex` names its reason** under a `## Why complex` heading in the ticket body (`ticket-lint.yml` checks it). No reason, no `complex` — it's `standard`.
- **Escalate once, then re-plan.** A stalled `standard` ticket first gets checked for an unclear spec, then moves up to `complexity:complex` once; note the escalation in the PR's Evidence section so the routing miss stays visible. If it fails again at `frontier`, the ticket goes back to `/grill-with-docs` — not to a bigger model.

## Review

Two reviewers do different jobs:

- **`/code-review`** checks the diff against the ticket (Spec) and this repo's docs (Standards). It needs the skills and the ticket.
- **Macroscope** hunts correctness bugs. It runs on Macroscope's own models, so it is independent of whichever model wrote the code and spends no Claude or Codex quota. It does not read the ticket.

| Label                 | Before opening the PR                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `complexity:trivial`  | CI only; Macroscope optional                                                                                                                       |
| `complexity:standard` | The `/code-review` that `/implement` runs in the writing session, then Macroscope                                                                  |
| `complexity:complex`  | Macroscope, then a **cross-provider** `/code-review` in a fresh session at `frontier` tier: Claude writes → Codex reviews, and the other way round |

A cross-provider session re-reads the ticket and diff from scratch on a second provider's quota. On `standard` work Macroscope supplies the independent eyes without that cost; keep the extra session for `complex`, where a missed spec or security mistake costs most. If a bug Macroscope should have caught reaches `master` from a `standard` ticket, say so in the issue and bring the cross-provider session back for `standard`. Gemini may add a free-form second opinion on any ticket, since that needs no skills.

**Running Macroscope.** Install once per machine from the [CLI docs](https://docs.macroscope.com/cli), then `macroscope setup`.

- In a harness: `/macroscope:codereview` (Claude Code), `$macroscope:codereview` (Codex), `/macroscope-codereview` (OpenCode). It reviews the branch against its base, checks each issue against the code, and fixes the real ones.
- From a terminal: `macroscope codereview --base master --raw`. Issues stream to stderr as `issue_event=<json>` lines; none means a clean review. `--mode budget` gives a cheaper pass.
- CLI reviews spend the workspace's agent credits (1,000 free a month). Automatic PR review stays off: comment `@macroscope-app review` on a PR to request one. It bills per KB of diff from the prepaid balance, so save it for `complex` PRs.

## Auditing routing

The `Co-Authored-By` trailer (see `git-workflow.md`) names the model that did the work, so comparing a PR's trailer(s) against its ticket's final `complexity:*` label shows whether routing matched reality — no separate field to keep in sync. An escalated ticket can leave two trailers on one PR (one per tier it passed through); read them alongside the Evidence-section escalation note.

## Adopting a model: its co-author address

A model joining the tier table needs a `Co-Authored-By` address. Resolve it in this order:

1. **A service account on the GitHub org for that model or agent.** This is the only form that gives real GitHub attribution — a linked avatar and contribution-graph credit. Use that account's numeric `noreply` address: `Co-Authored-By: <Model Display Name> <ID+username@users.noreply.github.com>`. Register the account once and give each model its own.
2. **The model's own GitHub bot account, if it has one.** Same numeric form — e.g. `Co-Authored-By: Copilot <223556219+Copilot@users.noreply.github.com>`.
3. **The vendor's documented AI co-author address**, when the vendor publishes one — e.g. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Co-Authored-By: GPT-6.1 Sol <noreply@openai.com>`. This renders in the commit list but links to no profile; that is expected and honest, since there is no account to link.
4. **This repository's own agent address**: `Co-Authored-By: <Model Display Name> <noreply@vmblogistics.id>`. Never invent an address at a domain the project does not control.

Providers with no documented vendor address fall through to step 4 — today that is Gemini (via Antigravity) and DeepSeek (via OpenCode Go). The findings behind that are in `docs/research/llm-model-tiering-2026-09.md`, section "AI co-author addresses". Do **not** use the legacy `username@users.noreply.github.com` form — GitHub stopped issuing it in 2017 and it links to nothing.

Register the address with one line in `scripts/ai-coauthors.txt`; `scripts/check-commit-msg.sh` rejects any address missing from that file.
