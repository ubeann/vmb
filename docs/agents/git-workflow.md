# Git workflow: branches, commits, PRs

Conventions for branch names, commit messages, and PR bodies, inferred from this repo's history (PR #1, #2). Applies whether a human or an agent is authoring the change.

## Branch naming

For branches you create, use `<type>/<scope>/<slug>`, matching the commit type below — e.g. `feature/docs/architecture`, `fix/api/session-expiry`. A harness-created worktree can keep its generated branch name; do not rename a branch that the harness is tracking just to fit this convention.

## Choose the Git workflow

Check the current checkout with `git rev-parse --show-toplevel` and `git worktree list`. If the top level is the first path `git worktree list` prints and the current branch is `gitbutler/workspace`, you are in the GitButler-managed workspace; any other path is a linked worktree. Then choose by checkout and PR dependency:

| Checkout                           | Independent PR                                                                            | PR depending on an unmerged PR                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitButler-managed workspace        | Use a GitButler branch and `but pr new`.                                                  | Stack with `but move <child> --above <parent>` and publish with `but pr new <top> -t`.                                                                                                                    |
| Linked worktree, including T3 Code | Use its existing branch (or create one with Git), commit with Git, and publish with `gh`. | Base a child branch on its parent with Git and set the child PR's base to the parent branch with `gh`; use `gh stack` when the official extension is installed and the repository supports native stacks. |

Stack because one PR **depends on another unmerged PR**, not because an issue is large. Split a large issue into sub-issues when it needs multiple reviewable PRs; independent sub-issues do not need a PR stack. In a linked worktree, stay on the Git path and do not run `but setup` there. Revisit this choice when the installed GitButler version's worktree support has been verified for the required operations.

For a standalone worktree PR, keep the harness-provided branch if there is one. Otherwise create a ticket branch from the intended base. Commit with `git add <paths>` and `git commit`, then `git push -u origin HEAD` and `gh pr create --base master --head <branch>`. Use the commit and PR formats below. Git commits run the local hooks described below.

For a dependent worktree PR, create the child from the parent branch (`git switch -c <child> <parent>`, or create a new worktree at `<parent>`), then publish it with `gh pr create --base <parent> --head <child>`. Repeat for each layer. If the official `gh stack` extension is available and this repository supports native stacks, its `gh stack` commands can manage the same Git branches and PR chain. Check the resulting PR bases and diffs before review; a plain `gh pr create --base` chain is a manual stack, not proof of native stack enrollment.

## Commit messages

Conventional Commits, imperative mood, lowercase type:

```
docs: add architecture guide and decision records

- ARCHITECTURE.md: comprehensive overview of tech stack, infrastructure, and repository structure
- 9 ADRs documenting major decisions (database, ORM, backend, frontend, data fetching, forms, monorepo tooling, hosting)
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. The body is a bullet list of _what_ changed; _why_ belongs in the PR body, not the commit.

## Commit signing

Respect the contributor's configured commit signing. A contributor's signer may ask them to approve each commit, as a password-manager SSH agent does. Run the normal commit command and allow time for that approval. If signing fails or approval is unavailable, leave the changes uncommitted (and staged if using Git) and report the failure. Use an unsigned commit only when the contributor explicitly authorizes that exception for that commit; do not silently set `commit.gpgsign=false` or use `--no-gpg-sign`.

In a GitButler workspace, check `git config --show-origin --get gitbutler.signCommits` before committing. GitButler gives this setting precedence over `commit.gpgsign` and can set it to `false` locally after a signing failure, unless the contributor sets it to `true` at user level (`~/.gitconfig`). Restore signing for this repository with `git config --local gitbutler.signCommits true` when the signer is available. In a linked worktree, use the normal signed `git commit` flow. In either checkout, confirm a new commit is signed with `git cat-file -p HEAD`; its header includes a `gpgsig` block. For machine-specific setup with 1Password, see the [1Password setup guide](https://www.1password.dev/ssh/git-commit-signing); GitHub must have the public key registered as a **signing key** to mark commits Verified.

After pushing, check GitHub's **Verified** status for the commit. If an unsigned commit is already on your own PR branch, `git commit --amend --no-edit -S` and `git push --force-with-lease` can replace it after the signer is available; this changes the commit SHA, so confirm no one else has updated the branch before rewriting it. For a branch in the GitButler workspace, rewrite it with `but` history commands instead of `git commit --amend`.

## PR body

Two sections:

```
## Summary

- <bullet per notable change>

## Testing

- <what was actually run, or "Not run (documentation only — no code changes, no executable tests)">
```

Keep the PR title identical to (or a clean rollup of) the first commit's message headline.

## Model routing

Route work to a **tier** — `fast`, `daily`, or `frontier` — never straight to a model name. The rules below speak only in tiers; the one table that names models is the tier table, so a new model wave is a one-row edit.

### Tiers

| Tier       | Codex                                   | Claude                         | OpenCode                               |
| ---------- | --------------------------------------- | ------------------------------ | -------------------------------------- |
| `fast`     | GPT-6 Luna                              | —                              | DeepSeek V4.1 Flash (OpenCode Go plan) |
| `daily`    | GPT-6.1 Sol                             | Claude Sonnet 5.5              | —                                      |
| `frontier` | GPT-6 Astra (fallback / second opinion) | Claude Opus 5.5 (first choice) | —                                      |

Within a tier, alternate providers by quota and availability. **Gemini has no tier slot** — it is a second-opinion reviewer only (decision in #184): Antigravity has no skills (`harnesses.md`) and its only picker model is a Flash.

Pricing, benchmarks, and billing behind this table: `docs/research/llm-model-tiering-2026-09.md`. Re-verify the table when that file's review-by date passes **or when a provider is added**, and update both together.

### Which tier, by stage

| Stage                                                                 | Tier                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Planning: `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/wayfinder` | `frontier`, always — a weak spec degrades every ticket built from it |
| Building: `/implement`, `/tdd`                                        | From the ticket's `complexity:*` label (below)                       |
| Subagent legwork: searches, exploration, lookups, mechanical edits    | `fast`                                                               |
| Review: `/code-review`, Macroscope                                    | From the ticket's `complexity:*` label — see [Review](#review)       |

Skill-driven work (`/implement`, `/tdd`, `/code-review`, and the planning flows) goes only to a harness that has the skills — see `harnesses.md`.

### Complexity labels

| Label                 | Criteria                                                                                                                                                  | Tier       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `complexity:trivial`  | Mechanical, no design judgment: typo/doc fixes, dependency/version bumps, single obvious line fixes, boilerplate from an established pattern              | `fast`     |
| `complexity:standard` | The default. Feature work or bug fix following existing patterns or an already-decided design — even across several files                                 | `daily`    |
| `complexity:complex`  | Needs a stated reason: cross-cutting change, security- or data-integrity risk (e.g. rewriting production data), or a new architecture decision still open | `frontier` |

- **Set it once, at creation.** `/to-tickets` sets the label on each ticket it creates (and `/triage` on incoming issues); don't re-pick it by feel at pickup time. Apply it like any other label (`gh issue edit <n> --add-label "complexity:standard"` — see `issue-tracker.md`).
- **`complex` names its reason** in the ticket body. No reason, no `complex` — it's `standard`.
- **Escalate once, then re-plan.** A stalled `standard` ticket first gets checked for an unclear spec, then moves up to `complexity:complex` once; note the escalation in the PR's Testing section so the routing miss stays visible. If it fails again at `frontier`, the ticket goes back to `/grill-with-docs` — not to a bigger model.

### Review

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

### Auditing routing

The `Co-Authored-By` trailer (below) names the model that did the work, so comparing a PR's trailer(s) against its ticket's final `complexity:*` label shows whether routing matched reality — no separate field to keep in sync. An escalated ticket can leave two trailers on one PR (one per tier it passed through); read them alongside the Testing-section escalation note.

## Big issues: sub-issues and stacked PRs

A big issue — one too large for a single PR — stays focused on the plan; detail work moves to GitHub sub-issues, one per tracer-bullet ticket, linked via GitHub's native sub-issue relationship (the same `gh api` sub-issues-endpoint mechanic `issue-tracker.md`'s wayfinding operations use — reuse that linking call, not the `wayfinder:*` labels or map/claim/frontier-query flow around it, which are scoped to `/wayfinder`). Give each sub-issue its own branch and stack it on the one before it only when it depends on that ticket's changes. In a linked worktree, build the stack by hand as described in [Choose the Git workflow](#choose-the-git-workflow). In the GitButler workspace:

- `but move <child-branch> --above <parent-branch>` stacks an existing branch on its dependency
- `but pr new <top-branch> -t` publishes the whole stack in one step, with PR bases set automatically

Keep the big issue open as the tracking parent until every sub-issue's PR has merged; close each sub-issue as its own PR lands, not before.

## Merging

Default to **squash** (`gh pr merge --squash`) for a standalone ticket or the PR at the top of a stack — it collapses a small ticket into one clean commit on `master`.

**Exception: a PR that has a child branch stacked on top of it.** Squashing it replaces its commits with a new SHA, so the child ends up diffed against a stale base — a "phantom diff," sometimes surfaced as a false conflict (mechanics and sources: `docs/research/squash-merge-vs-stacked-prs.md`). Prefer `gh pr merge --merge`, which preserves the parent commits in the base history. If you use rebase-merge, GitHub rewrites those commits with new SHAs. In the GitButler workspace, run `but pull` immediately to restack local branches, then `but push <top-branch>` to publish the updated stack and refresh the remaining PR diffs. Complete this update before continuing work on the higher branches.

If this repo is enrolled in GitHub's native stacked-PR feature (public preview since 2026-07-30), merging the whole stack in one action applies squash per layer atomically and the exception above doesn't apply. Check with `but config forge github-stacks` — it reports whether GitButler is configured to use native stacks when available (`but config forge github-stacks disable` opts out) — but that only shows GitButler's local setting, not whether GitHub has actually enrolled this repo. Confirm the real thing by publishing a stack with `but pr new <top-branch> -t` and reading its output: it says explicitly whether it created a native GitHub stack or fell back to description-footer stacking.

For a manual stack made in linked worktrees, merge bottom-up with the same merge-method rule. After each lower PR merges, check that the next PR targets the right base and contains only its own changes; use `gh pr edit <number> --base master` if it still targets the merged branch. A merge commit preserves the parent commits. If a lower PR is squash- or rebase-merged anyway, first record its tip with `git rev-parse <parent-branch>`; deleting the branch on merge removes that ref. After the merge, run `git fetch origin` and `git rebase --onto origin/master <old-parent-sha> <next-branch>`, then `git push --force-with-lease`. Work upward one layer at a time. For a native GitHub stack, use its stack merge and rebase operations instead of manually rewriting its branches.

## Local hooks

`lefthook` (pinned in `.mise.toml`, config in `lefthook.yml`) runs local checks for fast feedback:

- **`pre-commit`**, on staged files: `prettier --write` (auto-fixes and re-stages), `eslint` on the file's own package, `shellcheck` on `scripts/**/*.sh`, `actionlint` when a workflow changes, and the preview identifier tests when `scripts/preview-identifiers*.sh` changes.
- **`commit-msg`**: a Conventional Commits subject, and the shape of the `Co-Authored-By` trailer when one is present.

`mise install` installs the hooks; run `lefthook install` by hand if you cloned before they existed, or after `but setup` (which installs its own `pre-commit`/`post-checkout` wrappers and can displace them — see gitbutler#12748).

**They run on `git commit` only.** The GitButler CLI does not invoke git hooks: verified against `but` 0.22.3, after `but setup`, with the project's **Run Git hooks** setting enabled — `but commit` still created a commit with a non-Conventional message _and_ a file failing eslint, while the same repository's `git commit` was correctly blocked. That setting governs GitButler's own GUI actions, not the CLI. So a GitButler-made commit is not checked by these hooks, and the `commit-msg` conventions are enforced only for commits made with `git`.

They are **fast feedback, never the gate** — CI is the gate (#61) — and they are bypassable:

```
git commit --no-verify -m "..."
```

A hook that fails is a bug to fix, not a flag to reach for reflexively.

## Co-authoring AI-assisted work

When a change was written or substantially drafted by an AI model, add a `Co-Authored-By` trailer crediting the model. Resolve the identity in this order:

1. **A service account on the GitHub org for that model or agent.** This is the only form that gives real GitHub attribution — a linked avatar and contribution-graph credit. Use that account's numeric `noreply` address: `Co-Authored-By: <Model Display Name> <ID+username@users.noreply.github.com>`. Register the account once and give each model its own.
2. **The model's own GitHub bot account, if it has one.** Same numeric form — e.g. `Co-Authored-By: Copilot <223556219+Copilot@users.noreply.github.com>`.
3. **The vendor's documented AI co-author address**, when the vendor publishes one — e.g. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Co-Authored-By: GPT-6.1 Sol <noreply@openai.com>`. This renders in the commit list but links to no profile; that is expected and honest, since there is no account to link.
4. **This repository's own agent address**: `Co-Authored-By: <Model Display Name> <noreply@vmblogistics.id>`. Never invent an address at a domain the project does not control.

Use the model's display name in the name part — not an internal model ID, and not the harness. Write `GPT-6.1 Sol <noreply@openai.com>`, not `Codex <noreply@openai.com>`: the routing audit (see Model routing) reads the name to tell which tier did the work, and a harness name hides that.

Providers with no documented vendor address fall through to step 4 — today that is Gemini (via Antigravity) and DeepSeek (via OpenCode Go), e.g. `Co-Authored-By: DeepSeek V4.1 Flash <noreply@vmblogistics.id>`. The findings behind that are in `docs/research/llm-model-tiering-2026-09.md`, section "AI co-author addresses". Do **not** use the legacy `username@users.noreply.github.com` form — GitHub stopped issuing it in 2017 and it links to nothing.

Every address used must be registered in `scripts/ai-coauthors.txt`. `scripts/check-commit-msg.sh` rejects a `Co-Authored-By` trailer whose address is not in that file, so adopting a new model is one line there, not a hook edit.
