# Model routing: tiers, reviews, adopting a model

Route work to a **tier** — `fast`, `daily`, `frontier` or `apex` — never straight to a model name. The rules below speak only in tiers; the one table that names models is the tier table, so a new model wave is a one-row edit.

## Tiers

| Tier       | Claude            |
| ---------- | ----------------- |
| `fast`     | Claude Haiku 5.5  |
| `daily`    | Claude Sonnet 5.5 |
| `frontier` | Claude Opus 5.5   |
| `apex`     | Claude Fable 5.1  |

Every tier is a Claude model; within a tier, alternate the two Claude accounts (below) by quota and availability. **Codex and OpenCode have no column since 2026-10-14**: the owner stopped using both, so nothing routes to them and the review step below no longer counts on them. Disable both provider instances in T3 Code settings so `orchestrator_capabilities` matches this table. **Gemini has no tier slot** — it is a second-opinion reviewer only (decision in #184) and the only non-Claude vendor left; on 2026-10-14 the Antigravity instance offered only Gemini 3.8 Flash, Gemini 3.1 Pro having left the picker. Revisit the slot at the next tier review.

**`apex` is a daytime tier.** The Max plan includes Fable up to half of the weekly limit, drawn from the same weekly pool as every other Claude model and spent about 2.5 times faster per token than Opus 5.5. So Fable goes only to short, owner-attended work whose output every later ticket depends on: the planning stage below, ADRs, ticket splitting and retros. The night loop and the dispatcher never use it: one unattended build could spend the week's planning share. When Fable is spent or unavailable, planning falls back to `frontier`.

**Quota.** The Claude plan is Max 5x (since 2026-10-11). Its five-hour and weekly limits are shared between Claude Code and claude.ai, so a daytime design session and the night loop draw from one pool. The `Claude Sharing` instance in T3 is a second account with its own pool; routing nights to one and days to the other is an owner decision, and both profiles must carry the same plugins (`harnesses.md`).

Pricing, benchmarks, plan terms and billing behind this table: `docs/research/llm-model-tiering-2026-09.md`, "October 2026 refresh" for the current rows. Re-verify the table when that file's review-by date passes **or when a provider is added**, and update both together.

## Which tier, by stage

| Stage                                                                                                                            | Tier                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Planning: `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/wayfinder`, ADRs, `/retro`, a prototype round's critique and grilling | `apex`, falling back to `frontier` — a weak spec degrades every ticket built from it                 |
| Building: `/implement`, `/tdd`                                                                                                   | From the ticket's `complexity:*` label (below)                                                       |
| Subagent legwork: searches, exploration, lookups, mechanical edits                                                               | `fast`                                                                                               |
| Review: `/code-review`, Macroscope                                                                                               | From the ticket's `complexity:*` label — see [Review](#review)                                       |
| Scheduled tasks (`ticket-loop.md`): the morning digest                                                                           | `fast` — it only reads                                                                               |
| Scheduled tasks: the dispatcher                                                                                                  | `daily`; move it to `fast` after a week of clean digests, since it launches threads and edits labels |

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
- **Macroscope** hunts correctness bugs. It runs on Macroscope's own models, so it is independent of whichever model wrote the code and spends no Claude or Gemini quota. It does not read the ticket.

| Label                 | Before opening the PR                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `complexity:trivial`  | CI only; Macroscope optional                                                                            |
| `complexity:standard` | The `/code-review` that `/implement` runs in the writing session, then Macroscope                       |
| `complexity:complex`  | Macroscope, then a **cross-provider** `/code-review` in a fresh session: Claude writes → Gemini reviews |

A cross-provider session re-reads the ticket and diff from scratch on a second vendor's quota. Run it with `delegate_task` and `role: review`, targeting the `antigravity` instance from `orchestrator_capabilities` on Gemini 3.8 Flash (High) (`t3-code.md`). Start the task by telling it to read `AGENTS.md`, since Antigravity does not load it up front; it has the skills as copies (`harnesses.md`), so it can run `/code-review` proper. Gemini 3.8 Flash is a `fast`-class model, so its value is independent eyes on the spec and the docs, not depth: a `complex` ticket still gets its depth from Macroscope and from the `frontier` writer. Name the reviewer model in the PR's Evidence. On `standard` work Macroscope supplies the independent eyes without that cost; keep the extra session for `complex`, where a missed spec or security mistake costs most. If a bug Macroscope should have caught reaches `master` from a `standard` ticket, say so in the issue and bring the cross-provider session back for `standard`. Gemini may add a free-form second opinion on any ticket, since that needs no skills.

**When Gemini has no usage left or Antigravity is down**, the fallback is a same-family review: a fresh session at `frontier` on the other Claude account (`Claude Sharing` if the writer ran on `Claude Personal`), on a model other than the writer's where the tier allows. A fresh session on another account still re-reads the ticket and diff with no memory of writing them, which is most of what the cross-provider session buys; what it loses is a second vendor's blind spots, so Evidence names it as same-family. That happened on 2026-10-11, when Codex ran out mid-day and the `complex` layer PR #372 was reviewed by the writing model's own family.

**Running Macroscope.** Install once per machine from the [CLI docs](https://docs.macroscope.com/cli), then `macroscope setup`.

- In a harness: `/macroscope:codereview` (Claude Code). It reviews the branch against its base, checks each issue against the code, and fixes the real ones.
- From a terminal: `macroscope codereview --base master --raw`. Issues stream to stderr as `issue_event=<json>` lines; none means a clean review. `--mode budget` gives a cheaper pass.
- CLI reviews spend the workspace's agent credits (1,000 free a month). Automatic PR review stays off: comment `@macroscope-app review` on a PR to request one. It bills per KB of diff from the prepaid balance, so save it for `complex` PRs.

## Auditing routing

The `Co-Authored-By` trailer (see `git-workflow.md`) names the model that did the work, so comparing a PR's trailer(s) against its ticket's final `complexity:*` label shows whether routing matched reality — no separate field to keep in sync. An escalated ticket can leave two trailers on one PR (one per tier it passed through); read them alongside the Evidence-section escalation note.

## Adopting a model: its co-author address

A model joining the tier table needs a `Co-Authored-By` address. Resolve it in this order:

1. **The agents' GitHub account, as its own trailer.** Real GitHub attribution — a linked avatar and contribution-graph credit — comes from the account `vmb-agent` (ID 341066383, a collaborator on this repo and on `vmb-assets` since 2026-10-12). GitHub allows one machine account per person, so every model shares it, and it is credited on a second line rather than standing in for the model: `Co-Authored-By: vmb-agent <341066383+vmb-agent@users.noreply.github.com>` after the model's trailer (`git-workflow.md`). The model's own address resolves through the steps below. Agent shells also run `gh` and push as this account (`harnesses.md`).
2. **The model's own GitHub bot account, if it has one.** Same numeric form — e.g. `Co-Authored-By: Copilot <223556219+Copilot@users.noreply.github.com>`.
3. **The vendor's documented AI co-author address**, when the vendor publishes one — e.g. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Co-Authored-By: GPT-6 Luna <noreply@openai.com>`. This renders in the commit list but links to no profile; that is expected and honest, since there is no account to link.
4. **This repository's own agent address**: `Co-Authored-By: <Model Display Name> <noreply@vmblogistics.id>`. Never invent an address at a domain the project does not control.

Providers with no documented vendor address fall through to step 4 — today that is Gemini (via Antigravity). The findings behind that are in `docs/research/llm-model-tiering-2026-09.md`, section "AI co-author addresses". Do **not** use the legacy `username@users.noreply.github.com` form — GitHub stopped issuing it in 2017 and it links to nothing.

Register the address with one line in `scripts/ai-coauthors.txt`; `scripts/check-commit-msg.sh` rejects any address missing from that file.
