# Model routing: tiers, reviews, adopting a model

Route work to a **tier** — `fast`, `daily`, `frontier` or `apex` — never straight to a model name. The rules below speak only in tiers; the one table that names models is the tier table, so a new model wave is a one-row edit.

## Tiers

| Tier       | Claude            |
| ---------- | ----------------- |
| `fast`     | Claude Haiku 5.5  |
| `daily`    | Claude Sonnet 5.5 |
| `frontier` | Claude Opus 5.5   |
| `apex`     | Claude Fable 5.1  |

Every tier is a Claude model; within a tier, alternate the two Claude accounts (below) by quota and availability. **Codex and OpenCode have no column since 2026-10-14**: the owner stopped using both, so nothing routes to them and the review step below no longer counts on them. **Gemini has no slot of any kind since 2026-10-18.** It was a second-opinion reviewer only (decision in #184), and of its six review rounds between 10 and 17 October one looped on every file read, one failed to open a session, one was discarded for quoting another repo's test output, and three were useful. The [Review](#review) section replaces it with a fresh-context Claude session, which is what the second opinion bought. Disable the Codex, OpenCode and Antigravity provider instances in T3 Code settings so `orchestrator_capabilities` matches this table; re-verify a provider from scratch if it comes back.

**`apex` is a daytime tier.** The Max plan includes Fable up to half of the weekly limit, drawn from the same weekly pool as every other Claude model and spent about 2.5 times faster per token than Opus 5.5. So Fable goes only to short, owner-attended work whose output every later ticket depends on: the planning stage below, ADRs, ticket splitting and retros. The night loop and the dispatcher never use it: one unattended build could spend the week's planning share. When Fable is spent or unavailable, planning falls back to `frontier`.

**Quota.** The Claude plan is Max 5x (since 2026-10-11). Its five-hour and weekly limits are shared between Claude Code and claude.ai, so a daytime design session and the night loop draw from one pool. The `Claude Sharing` instance in T3 is a second account with its own pool; routing nights to one and days to the other is an owner decision, and both profiles must carry the same plugins (`harnesses.md`).

Pricing, benchmarks, plan terms and billing behind this table: `docs/research/llm-model-tiering-2026-09.md`, "October 2026 refresh" for the current rows. Re-verify the table when that file's review-by date passes **or when a provider is added**, and update both together.

## Which tier, by stage

| Stage                                                                                                                            | Tier                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Planning: `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/wayfinder`, ADRs, `/retro`, a prototype round's critique and grilling | `apex`, falling back to `frontier` — a weak spec degrades every ticket built from it                 |
| Building: `/implement`, `/tdd`                                                                                                   | From the ticket's `complexity:*` label (below)                                                       |
| Subagent legwork: searches, exploration, lookups, mechanical edits                                                               | `fast`                                                                                               |
| Review: `/code-review`, the fresh-context review, `/security-review`, Macroscope                                                 | From the ticket's `complexity:*` label and the paths touched — see [Review](#review)                 |
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

Review is layered. The layers that read the ticket and the docs run on Claude; the bug hunts run on other vendors' models (Macroscope, and on trial Sourcery and CodeRabbit), which review but never write: no second code-writing vendor since 2026-10-18. The shape follows Anthropic's account of its own flow ([Solving code review at Anthropic](https://claude.dev/blog/solving-code-review-at-anthropic/), 2026-10-15): verification before the PR, a fresh-context reviewer whose findings are checked, a separate security pass that can block, and rounds that converge.

- **`/code-review`** (mattpocock) checks the diff against the ticket (Spec) and this repo's docs (Standards). It runs in the writing session. Its Standards axis reads `CODING_STANDARDS.md`, the brief for what a reviewer looks for here, then the ADRs and `docs/agents/*.md` it names.
- **The fresh-context review** is Claude Code's built-in `code-review` skill (the `Skill` tool with `code-review` and an effort of `low`, `medium` or `high`), run in a session that did not write the code. It hunts bugs and returns findings as file, line, summary and failure scenario, verified before they are reported. Ten threads used it between 10 and 17 October; it found the Better Auth OTP path that never matched and the breadcrumb that ignored the permission seam.
- **`/security-review`**, Claude Code's built-in command, reads the diff for injection, broken auth, secret handling and data exposure. A high finding blocks the merge until it is fixed or the owner accepts it.
- **Macroscope** hunts correctness bugs on Macroscope's own models, so it is independent of whichever model wrote the code and spends no Claude quota. It does not read the ticket.
- **Sourcery and CodeRabbit**, on trial since 2026-10-18, are two more bug hunters on models other than the writer's, free on a public repository (`docs/research/free-tier-code-review-public-repo.md`); CodeRabbit names OpenAI and Anthropic, Sourcery does not name its vendor, so only CodeRabbit's independence from Claude is confirmed. Both read the diff only. Neither reviews a draft on its own: the build asks with a comment after the first green `Verify` (`ticket-loop.md`, Build), so a PR gets one review when it is worth reviewing, and the findings follow the three-round rule below. CodeRabbit's Open Source plan needs the comment anyway below 10 stars, and `.coderabbit.yaml` keeps automatic review and every walkthrough extra off; Sourcery's quiet settings live in its dashboard, set by `scripts/setup-review-apps.sh`; its label allowlist names a label no PR carries, so it never reviews on its own, not even when the gate marks the PR ready, while the comment still gets through (tested on PR #487). Decide in the first week of November 2026 whether they stay in the table: CodeRabbit puts every new organisation on a 14-day Advanced trial that ends 2026-11-01, and the free-tier reviews after it are the ones to judge. Record the decision in an ADR if the ladder changes.

| Label                 | Review layers, in order                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `complexity:trivial`  | CI only; Macroscope optional                                                                                                                                                                                                                                                                                                               |
| `complexity:standard` | The `/code-review` that `/implement` runs in the writing session, then the on-request reviewers (Sourcery, CodeRabbit), then Macroscope                                                                                                                                                                                                    |
| `complexity:complex`  | The on-request reviewers, Macroscope, then the fresh-context review at `high` on the other Claude account, then `/security-review`                                                                                                                                                                                                         |
| Any label             | `/security-review` too when the diff touches `apps/api`, `packages/db` (schema or migrations), the permission code (ADR-0045), the CSP (`apps/web/svelte.config.js`, `hooks.server.ts`, ADR-0047), `fnox.toml` or `.github/`. These are the merge gate's one-way paths plus the API, so the trigger is the file list, not a judgement call |

**Running the fresh-context review.** Use `delegate_task` with `role: review`, targeting the Claude instance the writer did not use (`Claude Sharing` when the writer ran on `Claude Personal`) on the `frontier` model; resolve the IDs with `orchestrator_capabilities` (`t3-code.md`). The task's prompt: read `AGENTS.md`, run the `code-review` skill at `high` against `master`, run `/security-review` when the table says so, and return every finding verbatim with its file and line. The reviewing session has no memory of writing the code, which is most of what the old cross-provider step bought; what it loses is a second vendor's blind spots, and Macroscope keeps supplying those. Name the reviewer model and account in the PR's Evidence. If a bug the fresh-context review should have caught reaches `master` from a `standard` ticket, say so in the issue and bring the review to `standard`.

**Answer every finding, converge in three rounds.** Each finding gets a reply in the PR: a commit that fixes it, or one sentence on why not. A re-review reads the diff since the last round, not the whole PR, and a reviewer that repeats a closed finding is told so once. After three rounds the remaining findings go to the owner in the decision brief; there is no fourth round. The same cap holds for the owner's review rounds on one PR (PR #376 took four): after the third, the thread asks for a call on what is left instead of another round.

**Bugs that reached `master` are the eval.** When a bug ships, the issue that fixes it says which review layer should have caught it, in a `## Review miss` section. Re-run that layer on the original diff after any change to this section, so a routing change is judged on the misses it would have caught. #375 and #395, two tests that were flaky on `master`, are the first entries.

**Running Macroscope.** Install once per machine from the [CLI docs](https://docs.macroscope.com/cli), then `macroscope setup`.

- In a harness: `/macroscope:codereview` (Claude Code). It reviews the branch against its base, checks each issue against the code, and fixes the real ones.
- From a terminal: `macroscope codereview --base master --raw`. Issues stream to stderr as `issue_event=<json>` lines; none means a clean review. `--mode budget` gives a cheaper pass.
- CLI reviews spend the workspace's agent credits (1,000 free a month). Automatic PR review stays off, and so do Macroscope's automatic PR summaries and approvability verdicts: they woke build threads 38 times between 10 and 17 October with nothing to act on. Only the owner can comment `@macroscope-app review` on a PR, since `vmb-agent` has no Macroscope seat; it bills per KB of diff from the prepaid balance, so save it for `complex` PRs.
- The CLI refuses to run when it wants `macroscope update`, which also rewrites `~/.claude/settings.json` and the Codex and OpenCode configs; the owner runs the update, never a build. A build that cannot run Macroscope writes `Macroscope: not run (CLI needs update)` under Evidence and does not count the PR as reviewed by it; the owner reads that line in the decision brief. That happened on PR #448's second round and PR #451.

**To adopt.** The `code-review` plugin on the official Claude plugin marketplace is the flow from the article as a command: five parallel hunters, a confidence vote that drops anything under 80, and one comment on the PR. It skips draft PRs and reads `CLAUDE.md` files only, so it needs a root `CLAUDE.md` pointing at `AGENTS.md` and a PR marked ready. Try it on one `complex` PR before adding it to the table.

## Auditing routing

The `Co-Authored-By` trailer (see `git-workflow.md`) names the model that did the work, so comparing a PR's trailer(s) against its ticket's final `complexity:*` label shows whether routing matched reality — no separate field to keep in sync. An escalated ticket can leave two trailers on one PR (one per tier it passed through); read them alongside the Evidence-section escalation note.

## Adopting a model: its co-author address

A model joining the tier table needs a `Co-Authored-By` address. Resolve it in this order:

1. **The agents' GitHub account, as its own trailer.** Real GitHub attribution — a linked avatar and contribution-graph credit — comes from the account `vmb-agent` (ID 341066383, a collaborator on this repo and on `vmb-assets` since 2026-10-12). GitHub allows one machine account per person, so every model shares it, and it is credited on a second line rather than standing in for the model: `Co-Authored-By: vmb-agent <341066383+vmb-agent@users.noreply.github.com>` after the model's trailer (`git-workflow.md`). The model's own address resolves through the steps below. Agent shells also run `gh` and push as this account (`harnesses.md`).
2. **The model's own GitHub bot account, if it has one.** Same numeric form — e.g. `Co-Authored-By: Copilot <223556219+Copilot@users.noreply.github.com>`.
3. **The vendor's documented AI co-author address**, when the vendor publishes one — e.g. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Co-Authored-By: GPT-6 Luna <noreply@openai.com>`. This renders in the commit list but links to no profile; that is expected and honest, since there is no account to link.
4. **This repository's own agent address**: `Co-Authored-By: <Model Display Name> <noreply@vmblogistics.id>`. Never invent an address at a domain the project does not control.

Providers with no documented vendor address fall through to step 4 — Gemini (via Antigravity) did while it reviewed; no routed model does today. The findings behind that are in `docs/research/llm-model-tiering-2026-09.md`, section "AI co-author addresses". Do **not** use the legacy `username@users.noreply.github.com` form — GitHub stopped issuing it in 2017 and it links to nothing.

Register the address with one line in `scripts/ai-coauthors.txt`; `scripts/check-commit-msg.sh` rejects any address missing from that file.
