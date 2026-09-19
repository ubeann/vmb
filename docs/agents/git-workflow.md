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

## Merging

Merge with `gh pr merge --merge` (merge commit, not squash) — history so far preserves each PR's own commit(s) rather than squashing them away.

## Local hooks

`lefthook` (pinned in `.mise.toml`, config in `lefthook.yml`) runs local checks for fast feedback:

- **`pre-commit`**, on staged files: `prettier --write` (auto-fixes and re-stages), `eslint` on the file's own package, `shellcheck` on `scripts/**/*.sh`, and `actionlint` when a workflow changes.
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
