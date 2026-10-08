# Ticket loop: shape, build, gate, decide

Tickets are built **unattended** at night and reviewed by the owner in the morning. The owner shapes tickets and makes decisions; agents claim, build, review and merge what the gate allows.

| Phase  | Who                       | When                                            | Section                           |
| ------ | ------------------------- | ----------------------------------------------- | --------------------------------- |
| Shape  | Owner + `frontier` tier   | Daytime                                         | [Shape](#shape)                   |
| Build  | One agent thread a ticket | Launched by the dispatcher in the night windows | [Build](#build)                   |
| Gate   | The same agent thread     | End of every build                              | [Gate](#gate)                     |
| Decide | Owner                     | Morning, from the digest                        | [Morning digest](#morning-digest) |

Labels are defined in `triage-labels.md`; this doc says when they move.

## Shape

`/grill-with-docs` → `/to-spec` → `/to-tickets`, as in `/ask-matt`. An idea with several open questions starts as a `/wayfinder` map whose destination is the spec. Raw issues someone else filed go through `/triage` instead. Every ticket leaves this phase as `ready-for-agent` with:

- the `/to-tickets` sections (the Research form's, for a `research` ticket), with criteria a reviewer can check from the diff, the preview and CI;
- one `complexity:*` label, and a `## Why complex` heading when it is `complex`;
- `review:human` when a criterion needs the owner's eyes;
- the reference images it was shaped from, uploaded (`issue-tracker.md`, "Images").

`ticket-lint.yml` bounces a ticket that misses any of these back to `needs-triage`.

## Build

You are a thread launched on one ticket, in your own worktree on a branch the dispatcher named. Nobody is watching: decide, note the decision in the PR, and keep going. Stop only at one of the three **end states** below.

1. **Claim.** If the ticket has no assignee (you were started by hand), `gh issue edit <n> --add-assignee @me`.
2. **Refresh.** Read the ticket and its comments (`issue-tracker.md`). Confirm every blocker is closed and each criterion still makes sense on current `master`: things it asks you to create may already exist, files or components it names may have moved. If the ticket is **stale** in a way that changes what to build, comment what changed, run `gh issue edit <n> --remove-label ready-for-agent --add-label needs-triage --remove-assignee @me`, and stop. Small drift that doesn't change the outcome goes in the PR's Evidence and you continue.
3. **Build** with `/implement`, or `/research` for a `research` ticket: its questions are the criteria, and the findings land in `docs/research/<slug>.md`. Keep the branch you were given; the PR's `Closes #<n>` links it to the ticket, so skip `gh issue develop`.
4. **Open a draft PR** (`git-workflow.md`, PR body). Link it to your thread with `link_pull_request`, then `watch_pull_request`. T3 wakes you when checks finish or someone comments.
5. **Prove each criterion.** For a UI change, once the preview is up, run the page checks (`page-checks.md`) and upload the captures you cite. Tick a criterion only with its evidence next to it. One you can't verify, such as the owner's review, stays unticked.
6. **Review** at the ticket's tier (`model-routing.md`, Review). Fix what holds up, push, and wait for green checks.
7. **Gate** the PR (next section). That ends in one of the end states.

**End states.** Every build ends in exactly one, and the ticket shows which:

- **Merged**: the gate passed and you merged; the ticket closed through `Closes #<n>`.
- **Waiting on the owner**: the PR is ready for review, labelled `needs-decision`, with a decision brief; `ready-for-agent` is off the ticket and the assignee stays.
- **Back in triage**: the ticket was stale or its spec can't be built as written; it is `needs-triage` with a comment saying why, and nothing is merged.

If the build fails in a way you can't fix (red checks you can't make green, a criterion you can't meet), that is a decision for the owner: push what you have and take the **waiting on the owner** path. The brief says where it stands.

## Gate

Run `scripts/merge-gate.sh <pr>`. It passes only a clean PR that closes `trivial` or `standard` tickets, has green checks and every criterion ticked, declares a two-way door, and touches no migration, schema, workflow, deploy or secrets file; the script's header lists the rules. Merging to `master` deploys to production, which is why the gate is strict and why only the script may approve a merge.

- **PASS**: `gh pr ready <pr>`, then `gh pr merge <pr> --squash --delete-branch`, then `unwatch_pull_request`.
- **FAIL**: `gh pr ready <pr>`, `gh pr edit <pr> --add-label needs-decision`, then `gh issue edit <n> --remove-label ready-for-agent`. Then post the **decision brief** as a PR comment: the gate's reasons, what you'd recommend, and the one question the owner must answer. Stay watching: when the owner leaves review comments, act on them and push. The merge itself is the owner's.

Never merge past a FAIL, and never edit a label or the body just to make the gate pass. A criterion becomes ticked only when its evidence exists.

## Dispatcher

A T3 scheduled task runs this in the night windows (17:10–22:10 and 22:15–03:15 WIB, matching the owner's usage resets). Its prompt names the window's end and the Claude provider instance to use. Each run tops up the builds in flight, so it can run several times a window. The tasks post into a dedicated dispatcher thread in **full-access** mode: T3 refuses `t3_thread_launch` from any other mode.

1. **Room left.** If less than 90 minutes remain before the window ends, report that and stop: a build launched now would run out of usage mid-way.
2. **Count slots.** Builds in flight are open `ready-for-agent` tickets with an assignee. Run at most **2**. With no free slot, report and stop.
3. **Find the frontier.** `gh issue list --label ready-for-agent --state open --json number,title,labels,assignees,milestone`, keep the unassigned ones, and drop any with an open blocker (`gh api repos/ubeann/vmb/issues/<n> --jq .issue_dependencies_summary.blocked_by` above 0, or an open issue in a `Blocked by` line), and any that fail `scripts/ticket-lint.sh` (body on stdin, labels comma-joined as the argument): ticket-lint only runs when a ticket changes, so older tickets can still lack a tier. Tickets in the open milestone come first, then the rest; lowest number first within each.
4. **Claim and launch**, one ticket per free slot:
   - `gh issue edit <n> --add-assignee @me`;
   - `t3_thread_launch` with title `#<n> <ticket title>`, `workspaceStrategy` `{"type":"worktree","baseRef":"master","startFromOrigin":true,"branch":"<type>/<scope>/<slug>"}` (type `fix` for a `bug`, `docs` for a `research` ticket, otherwise `feature`; scope and slug from the ticket, as in `git-workflow.md`), and the model for the ticket's tier: the Claude model from `model-routing.md`'s tier table on the named Claude instance for `standard` and `complex`, and the Codex `fast` model for `trivial`. Resolve the IDs with `orchestrator_capabilities`;
   - message: `/mattpocock-skills:implement #<n>` on its first line (`/mattpocock-skills:research #<n>` for a `research` ticket), then `Unattended build: follow docs/agents/ticket-loop.md, Build, to an end state.`;
   - comment on the ticket with the thread id;
   - if the launch fails, release the claim (`gh issue edit <n> --remove-assignee @me`) and report the error, so the slot frees for the next run.
5. **Report** one line per launch (ticket, tier, thread), or why nothing launched.

Done when every free slot holds a launched build or the frontier is empty.

## Morning digest

A T3 scheduled task at 07:00 WIB. It only reads; the owner acts on it. List, newest first:

1. **Decide**: open PRs labelled `needs-decision`, each with the one question from its decision brief.
2. **Merged overnight**: PRs merged since 17:00 yesterday, with the ticket each closed.
3. **Bounced**: tickets that moved to `needs-triage` since then, with the reason from their last comment.
4. **Stalled**: claimed `ready-for-agent` tickets with no open PR whose claim comment is older than 6 hours. Name the thread so the owner can look.
5. **Next up**: the frontier as the dispatcher would see it tonight, the open milestone's progress (closed of total), and how many `ready-for-agent` tickets fail ticket-lint or lack a tier.
