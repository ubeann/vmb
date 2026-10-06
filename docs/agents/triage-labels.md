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

A ticket carries one category (`bug` or `enhancement`) and one state from the table above. A `ready-for-agent` ticket also needs:

- **Exactly one `complexity:*` label**: `trivial`, `standard` or `complex`, chosen when the ticket is created (criteria in `model-routing.md`). A `complex` ticket states its reason under a `## Why complex` heading.
- **`review:human`** when an acceptance criterion needs the owner's eyes: a design call, a look on a real device, anything no check can settle. The agent still builds it; the PR just never merges without the owner.

`.github/workflows/ticket-lint.yml` checks those rules on every `ready-for-agent` ticket and moves one that fails back to `needs-triage`.

On a PR, **`needs-decision`** means the merge gate stopped it or the agent needs the owner's call; the PR's last comment says which. An **assignee** on a `ready-for-agent` ticket means an agent has claimed it. How the labels move through a build is in `ticket-loop.md`.
