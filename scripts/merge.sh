#!/usr/bin/env bash
#
# The one way a PR is merged here, by an agent or the owner's proxy: run
# `scripts/merge-gate.sh`, and on PASS mark the PR ready and squash-merge the
# exact head the gate judged. Merging to `master` deploys to production
# (`ci.yml`'s Release job), so the gate is not optional; between 11 and 18
# October 2026 nine PRs were merged by hand on `gh pr checks` alone, one of
# them auth code with no review round.
#
# The gate FAILs a one-way PR, a `complex` ticket and anything the owner must
# decide. When the owner has given the call, `--owner-approved "<who, where,
# when>"` records it as a PR comment with the gate's reasons at that moment,
# then merges; that is the only way past a FAIL, and the comment is the audit
# trail. The text is the caller's word: this script runs with the agent's own
# merge-capable token, which could run `gh pr merge` directly, so the comment
# makes the bypass visible rather than impossible (ADR-0058). A gate that did
# not reach a verdict (a failed GitHub call, a jq error) is never overridden.
# Nothing here edits a label or the body to make the gate pass.
#
# The head is read before the gate and the merge is pinned to it with
# `--match-head-commit`, so a commit pushed between the two is refused by
# GitHub instead of merging unjudged.
#
# Past the gate, `scripts/pace.sh` decides when (ADR-0059): at most 12 agent
# merges a WIB day, 15 minutes apart. When it says WAIT, the PR is labelled
# `merge-paced` and left as it is, and the next dispatcher run (or the owner,
# from the digest) runs this script again. The pace holds an owner-approved
# merge too: it limits the account, whoever made the call.
#
# Usage:
#   scripts/merge.sh <pr-number>                         gate, ready, squash-merge
#   scripts/merge.sh <pr-number> --owner-approved "<text>"
#       merge past a FAIL on the owner's recorded instruction, e.g.
#       --owner-approved "ubeann in the T3 thread, 2026-10-18 19:21 WIB"
#   scripts/merge.sh <pr-number> --dry-run
#       run the reads (the head lookup, the gate) and print the writes
#       (comment, ready, merge) without running them
#
# Exits 0 when merged (or, with --dry-run, when it would be), 1 when the gate
# refused and no approval was given or when it or the pace reached no verdict,
# 3 when the gate passed and the pace says wait. After a merge, a T3 thread
# calls `unwatch_pull_request`. Tests: `bash scripts/merge.test.sh`.

set -euo pipefail

usage() {
  echo 'usage: merge.sh <pr-number> [--owner-approved "<text>"] [--dry-run]' >&2
  exit 2
}

[ $# -ge 1 ] || usage
pr=$1
shift
approved=""
dry_run=false
while [ $# -gt 0 ]; do
  case "$1" in
    --owner-approved)
      # The value is the record of the owner's call, so an empty one or the
      # next flag is a mistake, not an approval.
      case "${2-}" in
        '' | -*) usage ;;
      esac
      approved=$2
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    *) usage ;;
  esac
done
case "$pr" in
  '' | *[!0-9]*) usage ;;
esac

# The tests point these at stubs; a build never sets them.
gate=${MERGE_GATE:-"$(dirname "${BASH_SOURCE[0]:-$0}")/merge-gate.sh"}
pace=${MERGE_PACE:-"$(dirname "${BASH_SOURCE[0]:-$0}")/pace.sh"}

run() {
  if $dry_run; then
    printf 'would run: %s\n' "$*"
  else
    "$@"
  fi
}

head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)

reasons=$(bash "$gate" "$pr" 2>&1) || true
printf '%s\n' "$reasons"

past_fail=false
case "$(printf '%s\n' "$reasons" | head -n 1)" in
  PASS) ;;
  FAIL)
    past_fail=true
    if [ -z "$approved" ]; then
      echo "Not merged: the gate refused. Take the waiting-on-the-owner path (docs/agents/ticket-loop.md, Gate)." >&2
      exit 1
    fi
    ;;
  *)
    echo "Not merged: the gate reached no verdict, so there is nothing to approve past. Fix the error above and run again." >&2
    exit 1
    ;;
esac

# Before any write, so a paced run leaves no approval comment to repeat later.
pace_says=$(bash "$pace" 2>&1) || true
printf '%s\n' "$pace_says"
case "$(printf '%s\n' "$pace_says" | head -n 1)" in
  OK) ;;
  WAIT)
    run gh pr edit "$pr" --add-label merge-paced
    echo "Not merged: the gate passed and the pace says wait. #$pr is labelled merge-paced; the next dispatcher run merges it (docs/agents/ticket-loop.md, Gate)." >&2
    exit 3
    ;;
  *)
    echo "Not merged: the pace check reached no verdict. Fix the error above and run again." >&2
    exit 1
    ;;
esac

if $past_fail; then
  # shellcheck disable=SC2016 # the backticks are Markdown, not a command
  run gh pr comment "$pr" --body "$(printf 'Owner approved the merge past the gate: %s\n\nThe gate said at the time, on head %s:\n\n```\n%s\n```' "$approved" "$head" "$reasons")"
fi

# `gh pr ready` on a PR that is already ready warns and exits 0.
run gh pr ready "$pr"
run gh pr merge "$pr" --squash --delete-branch --match-head-commit "$head"
if $dry_run; then
  echo "Dry run: #$pr would merge at head $head. Nothing was changed."
else
  echo "Merged #$pr at head $head. In a T3 thread, call unwatch_pull_request now."
fi
