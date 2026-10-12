# ADR-0054: A `master` ruleset requires `Verify`, with no approvals and strict mode off

**Amended by #381:** `Real Postgres` is a step of `Verify` and no longer a check of its own (ADR-0043), so `Verify` is the only required check. The owner re-applies `scripts/master-ruleset.sh` before that PR merges: the old ruleset requires a `Real Postgres` check the PR no longer produces, so the PR would wait on it forever.

**Context:** Merging to `master` deploys production (`ci.yml`'s Release job). While the repository was on GitHub's free plan, a private repo had no branch protection, so `scripts/merge-gate.sh` was the only thing between a red or unreviewed PR and production, and nothing stopped a force-push to `master`, a deleted branch, or a direct push. The repository is on Pro now, which gives it branch rulesets. Agents push as the owner, with the owner's token, so any rule applies to them and to the owner alike.

**Options considered:**

- **Keep `merge-gate.sh` alone.** It only runs when an agent remembers to, and it cannot stop a human or a stray command.
- **A ruleset that requires an approving review.** GitHub refuses a self-approval, and every agent PR is authored by the owner's account, so it would block every PR until someone else approved it. The repository has no second reviewer.
- **A ruleset with "require branches to be up to date" (strict status checks).** Every merge would make each other open PR out of date, and the next merge would wait for a fresh run of `Verify` on each of them. That spends CI minutes on a result the merge does not change.
- **A bypass list for the owner.** The owner's token is also the agents' token, so a bypass for one is a bypass for all.

**Decision:** `scripts/master-ruleset.sh` creates or updates, by name, a branch ruleset called `master` on the default branch. The owner runs it, because creating a ruleset needs repository admin and changes how every later merge behaves.

- `deletion` and `non_fast_forward`: `master` cannot be deleted or force-pushed.
- `pull_request` with **0** required approvals, no code-owner review and `squash` and `merge` as the allowed methods. A change reaches `master` through a PR, and merge stays allowed because a PR with a child branch stacked on it merges with `--merge` (`docs/agents/git-workflow.md`).
- `required_status_checks`: `Verify`, pinned to the GitHub Actions app (`integration_id` 15368) so no other app can report a status of that name, with `strict_required_status_checks_policy: false`.
- `bypass_actors: []`.
- No required approvals, because a review rule would block every agent PR (above). The one-way paths (migrations, the schema, workflows, deploy and secrets files) stay with `merge-gate.sh` and the owner's review (`review:human`).
- Strict mode off, because it would re-run CI on every open PR after each merge.

`merge-gate.sh` stays the only thing that decides what an agent may merge. The ruleset makes GitHub enforce the checks, the pull request and the history; the script keeps the rules GitHub cannot express (the ticket's tier, the criteria, the door).

**Trade-offs:** Nothing reaches `master` without a PR and a green `Verify`, and the history cannot be rewritten, at the cost of the owner having no quick route: a hotfix goes through a PR and its checks like anything else. A broken ruleset can still be fixed, because a ruleset is edited through Settings, Rules or the rulesets API and a branch rule does not govern either, but that takes repository admin. Without strict mode, two PRs that are each green can still conflict semantically once both merge; `Verify` runs again on `master` after every merge and catches that after the fact, not before. `rotate-fnox-age-key.sh` could no longer push to `master`, so it opens a PR instead. Revisit the approval rule if a second human reviewer joins, and strict mode if semantic conflicts between merged PRs become a pattern.
