# Git workflow: branches, commits, PRs

Conventions for branch names, commit messages, and PR bodies, inferred from this repo's history (PR #1, #2). Applies whether a human or an agent is authoring the change.

## Branch naming

`<type>/<scope>/<slug>`, matching the commit type below — e.g. `feature/docs/architecture`, `fix/api/session-expiry`.

## Commit messages

Conventional Commits, imperative mood, lowercase type:

```
docs: add architecture guide and decision records

- ARCHITECTURE.md: comprehensive overview of tech stack, infrastructure, and repository structure
- 9 ADRs documenting major decisions (database, ORM, backend, frontend, data fetching, forms, monorepo tooling, hosting)
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. The body is a bullet list of _what_ changed; _why_ belongs in the PR body, not the commit.

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

Before starting work on a ticket, set a `complexity:*` label — it decides which model tier picks up the work, and keeps expensive models off tickets that don't need them.

| Label                 | Criteria                                                                                                                                                                                   | Routes to                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `complexity:trivial`  | Mechanical, no design judgment: typo/doc fixes, dependency/version bumps, single obvious line fixes, boilerplate from an established pattern                                               | GPT-6 Luna                                                                         |
| `complexity:standard` | The default. Normal feature work or bug fix scoped to a few files, following existing patterns in the codebase                                                                             | GPT-6 Sol or Claude Sonnet 5 (same price; alternate by provider load/availability) |
| `complexity:complex`  | Cross-cutting or ambiguous requirements, novel architecture/design decisions, security- or data-integrity-sensitive changes, or any ticket that already failed once at the `standard` tier | Claude Opus 5.5 first, GPT-6 Astra as fallback/second opinion                      |

Skill-driven work (`/implement`, `/tdd`, `/code-review`) goes only to a harness that has the skills — see `harnesses.md`.

Apply it the same way as any other label (`gh issue edit <n> --add-label "complexity:standard"` — see `issue-tracker.md`). A `standard` ticket that stalls gets bumped to `complexity:complex` rather than retried blind on the same tier; note the escalation in the PR's Testing section so the routing miss is visible later.

The model that actually did the work is already recorded per-commit by the `Co-Authored-By` trailer (below), so there's no separate field to keep in sync — comparing a PR's trailer(s) against its ticket's final `complexity:*` label is enough to audit whether routing matched reality. An escalated ticket can leave two different trailers on one PR (one per tier it passed through); read the Testing-section escalation note alongside the trailers in that case rather than expecting a single trailer to match the final label.

Full pricing/benchmark rationale and the model lineup this table routes to: `docs/research/llm-model-tiering-2026-09.md`. That file carries its own review-by date — re-verify this table whenever that date is reached, since new model waves can shift which tier a name like "GPT-6 Sol" belongs to.

## Big issues: sub-issues and stacked PRs

A big issue — one too large for a single PR — stays focused on the plan; detail work moves to GitHub sub-issues, one per tracer-bullet ticket, linked via GitHub's native sub-issue relationship (the same `gh api` sub-issues-endpoint mechanic `issue-tracker.md`'s wayfinding operations use — reuse that linking call, not the `wayfinder:*` labels or map/claim/frontier-query flow around it, which are scoped to `/wayfinder`). Work each sub-issue on its own GitButler branch, stacked on the one before it when it depends on that ticket's changes:

- `but move <child-branch> --above <parent-branch>` stacks an existing branch on its dependency
- `but pr new <top-branch> -t` publishes the whole stack in one step, with PR bases set automatically

Keep the big issue open as the tracking parent until every sub-issue's PR has merged; close each sub-issue as its own PR lands, not before.

## Merging

Default to **squash** (`gh pr merge --squash`) for a standalone ticket or the PR at the top of a stack — it collapses a small ticket into one clean commit on `master`.

**Exception: a PR that has a child branch stacked on top of it.** Squashing it replaces its commits with a new SHA, so the child ends up diffed against a stale base — a "phantom diff," sometimes surfaced as a false conflict (mechanics and sources: `docs/research/squash-merge-vs-stacked-prs.md`). Prefer `gh pr merge --merge`, which preserves the parent commits in the base history. If you use rebase-merge, GitHub rewrites those commits with new SHAs: run `but pull` immediately to restack local branches, then `but push <top-branch>` to publish the updated stack and refresh the remaining PR diffs. Complete this update before continuing work on the higher branches.

If this repo is enrolled in GitHub's native stacked-PR feature (public preview since 2026-07-30), merging the whole stack in one action applies squash per layer atomically and the exception above doesn't apply. Check with `but config forge github-stacks` — it reports whether GitButler is configured to use native stacks when available (`but config forge github-stacks disable` opts out) — but that only shows GitButler's local setting, not whether GitHub has actually enrolled this repo. Confirm the real thing by publishing a stack with `but pr new <top-branch> -t` and reading its output: it says explicitly whether it created a native GitHub stack or fell back to description-footer stacking.

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
3. **The vendor's documented AI co-author address**, when the vendor publishes one — e.g. `Co-Authored-By: Claude <noreply@anthropic.com>`, `Co-Authored-By: Codex <noreply@openai.com>`. This renders in the commit list but links to no profile; that is expected and honest, since there is no account to link.
4. **This repository's own agent address**: `Co-Authored-By: <Model Display Name> <noreply@vmblogistics.id>`. Never invent an address at a domain the project does not control.

Use the model's display name in the name part, not an internal model ID. Do **not** use the legacy `username@users.noreply.github.com` form — GitHub stopped issuing it in 2017 and it links to nothing.

Every address used must be registered in `scripts/ai-coauthors.txt`. `scripts/check-commit-msg.sh` rejects a `Co-Authored-By` trailer whose address is not in that file, so adopting a new model is one line there, not a hook edit.
