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

In a GitButler workspace, check `git config --show-origin --get gitbutler.signCommits` before committing. GitButler gives this setting precedence over `commit.gpgsign` and can set it to `false` locally after a signing failure, unless the contributor sets it to `true` at user level (`~/.gitconfig`). Restore signing for this repository with `git config --local gitbutler.signCommits true` when the signer is available. In a linked worktree, use the normal signed `git commit` flow. Linked worktrees of this repo sign with a dedicated agent key, `~/.ssh/vmb_agent_signing`, which needs no approval, so an unattended build can commit; `~/.gitconfig` includes `~/.gitconfig-vmb-agent` for `gitdir:/Volumes/Gawean/vmb/.git/worktrees/`, which sets `user.signingkey` to that key and `gpg.ssh.program` to `ssh-keygen`. If a worktree commit still asks for 1Password, that include is missing. In either checkout, confirm a new commit is signed with `git cat-file -p HEAD`; its header includes a `gpgsig` block. For machine-specific setup with 1Password, see the [1Password setup guide](https://www.1password.dev/ssh/git-commit-signing); GitHub must have the public key registered as a **signing key** to mark commits Verified.

After pushing, check GitHub's **Verified** status for the commit. If an unsigned commit is already on your own PR branch, `git commit --amend --no-edit -S` and `git push --force-with-lease` can replace it after the signer is available; this changes the commit SHA, so confirm no one else has updated the branch before rewriting it. For a branch in the GitButler workspace, rewrite it with `but` history commands instead of `git commit --amend`.

## PR body

Write it with the `/pr` skill (Summary, Evidence, Merge Danger). This repo adds three things, and `scripts/merge-gate.sh` reads all of them:

- **`Closes #<n>`** as the first line, once per ticket the PR finishes. Use `Refs #<n>` only for a ticket that stays open after the merge.
- **`## Acceptance criteria`** after Evidence: the ticket's checklist, each item ticked only with its evidence beside it (a test name, a check, an uploaded screenshot). An item you couldn't verify stays unticked.
- **`**Door:** two-way`** or **`**Door:** one-way`**, spelled exactly so.

Upload screenshots with `scripts/upload-asset.sh <file> prs/<pr-number>` and paste the link it prints. What you ran, and a tier escalation (`model-routing.md`), go under Evidence; "Not run (documentation only)" is a valid entry there.

Keep the PR title identical to (or a clean rollup of) the first commit's message headline.

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

When a change was written or substantially drafted by an AI model, add a `Co-Authored-By` trailer naming the model's display name — not an internal model ID, and not the harness: `GPT-6.1 Sol <noreply@openai.com>`, not `Codex <noreply@openai.com>`, because the routing audit reads the name to tell which tier did the work. The address is the vendor's: `noreply@anthropic.com` for Claude, `noreply@openai.com` for GPT, and `noreply@vmblogistics.id` for providers with no documented address (Gemini, DeepSeek), e.g. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

The `commit-msg` hook rejects an address missing from `scripts/ai-coauthors.txt`. A model without an address yet gets one through the resolution order in `model-routing.md`.
