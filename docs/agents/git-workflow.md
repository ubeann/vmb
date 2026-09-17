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

## Co-authoring AI-assisted work

When a change was written or substantially drafted by an AI model, add a trailer to the commit:

```
Co-Authored-By: <Model Name> <noreply@anthropic.com>
```

e.g. `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Use the model's display name, not an internal model ID.
