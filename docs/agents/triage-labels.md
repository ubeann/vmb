# Triage labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## The rest of the vocabulary

A ticket carries one category (`bug`, `enhancement` or `research`) and one state from the table above. The category picks the issue form, and so the sections the lint expects: a `bug` says what's wrong and what to fix, an `enhancement` what to build, a `research` ticket what to find out (below). A `ready-for-agent` ticket also needs:

- **Exactly one `complexity:*` label**: `trivial`, `standard` or `complex`, chosen when the ticket is created (criteria in `model-routing.md`). A `complex` ticket states its reason under a `## Why complex` heading.
- **`review:human`** when an acceptance criterion needs the owner's eyes: a design call, a look on a real device, anything no check can settle. The agent still builds it; the PR just never merges without the owner.

`.github/workflows/ticket-lint.yml` checks those rules on every open, unclaimed `ready-for-agent` ticket and moves one that fails back to `needs-triage`; a claimed ticket is already being built, and the frontier never reads it.

On a PR, **`needs-decision`** means the merge gate stopped it or the agent needs the owner's call; the PR's last comment says which. **`merge-paced`** means the gate passed and `scripts/pace.sh` held the merge (ADR-0059); the dispatcher's next run merges it. An **assignee** on a `ready-for-agent` ticket means an agent has claimed it. How the labels move through a build is in `ticket-loop.md`.

## Research and wayfinder

- **`research`**: one sharp question answered by reading, filed with the Research issue form. It moves through the same states as a build ticket; once `ready-for-agent`, the night loop runs it with `/research` and its findings land in `docs/research/<slug>.md`. A research ticket that waits on other work carries native blocking links, so the wait shows in the tracker.
- **`wayfinder:*`**: an idea with several open questions is a `/wayfinder` map (`wayfinder:map`), and each child carries `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling` or `wayfinder:task`. These sit outside the states above: no state or `complexity:*` label, and the night loop never takes them; a wayfinder session claims them by assignee. A `research` ticket that turns out to hold several questions becomes a map when someone starts on it.
