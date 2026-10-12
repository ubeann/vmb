#!/usr/bin/env sh
#
# Validate a commit message against the conventions in docs/agents/git-workflow.md.
#
# Run by lefthook's `commit-msg` hook (issue #62). Enforces a Conventional
# Commits subject with no trailing `(#n)`, and the co-author trailers' shape,
# addresses and the `vmb-agent` line when a model is credited. The repo has no
# required status checks, so this is the only hard enforcement of the message
# conventions. Bypass deliberately with `--no-verify`.
#
# Usage: scripts/check-commit-msg.sh <commit-msg-file>

set -eu

msg_file=${1:?usage: check-commit-msg.sh <commit-msg-file>}

# Replayed messages during a rebase were not authored here — leave them alone.
git_dir=$(git rev-parse --git-dir 2>/dev/null || echo .git)
if [ -d "$git_dir/rebase-merge" ] || [ -d "$git_dir/rebase-apply" ]; then
  exit 0
fi

subject=$(head -n 1 "$msg_file")

# git-generated messages this hook should not police.
case "$subject" in
  "Merge "* | 'Revert "'* | "fixup! "* | "squash! "* | "") exit 0 ;;
esac

types="feat, fix, docs, chore, refactor, test, perf, build, ci, style"
if ! printf '%s\n' "$subject" |
  grep -Eq '^(feat|fix|docs|chore|refactor|test|perf|build|ci|style)(\([a-z0-9._/-]+\))?!?: .+'; then
  {
    echo "commit subject must be Conventional Commits: <type>(<scope>): <description>"
    echo "  types: $types"
    echo "  got:   $subject"
    echo "  bypass deliberately with --no-verify"
  } >&2
  exit 1
fi

# The ticket is linked by `Closes #<n>` in the PR body, and GitHub appends the
# PR's own `(#n)` when it squashes. A ticket number in the subject lands on
# `master` as `... (#418) (#420)`, two numbers nobody can tell apart.
if printf '%s\n' "$subject" | grep -Eq '\(#[0-9]+\)[[:space:]]*$'; then
  {
    echo "commit subject must not end with an issue number: GitHub adds the PR's (#n) at squash"
    echo "  link the ticket with 'Closes #<n>' in the PR body, or 'Refs: #<n>' in the commit body"
    echo "  got:   $subject"
    echo "  bypass deliberately with --no-verify"
  } >&2
  exit 1
fi

# The trailer is optional (a human commit has none), but every trailer present
# must be well formed and name an address registered in scripts/ai-coauthors.txt
# (see docs/agents/model-routing.md for the resolution order).
coauthor_list=$(dirname "$0")/ai-coauthors.txt
if grep -q '^Co-Authored-By: ' "$msg_file"; then
  if [ ! -f "$coauthor_list" ]; then
    {
      echo "co-author registry not found: $coauthor_list"
      echo "  bypass deliberately with --no-verify"
    } >&2
    exit 1
  fi

  well_formed=$(sed -n 's/^Co-Authored-By: [^<>]*<\([^<>]*@[^<>]*\)>$/\1/p' "$msg_file")
  trailer_count=$(grep -c '^Co-Authored-By: ' "$msg_file" || true)
  address_count=0
  if [ -n "$well_formed" ]; then
    address_count=$(printf '%s\n' "$well_formed" | wc -l | tr -d '[:space:]')
  fi

  if [ "$trailer_count" -ne "$address_count" ]; then
    {
      echo "every Co-Authored-By trailer must read:"
      echo "  Co-Authored-By: <Model Name> <address@domain>"
      grep -i '^Co-Authored-By:' "$msg_file" >&2
      echo "  bypass deliberately with --no-verify"
    } >&2
    exit 1
  fi

  unregistered=$(printf '%s\n' "$well_formed" | grep -vFx -f "$coauthor_list" || true)
  if [ -n "$unregistered" ]; then
    {
      echo "unregistered Co-Authored-By address(es):"
      printf '%s\n' "$unregistered" | sed 's/^/  /'
      echo "  register the address in $coauthor_list"
      echo "  see docs/agents/model-routing.md for the resolution order"
      echo "  bypass deliberately with --no-verify"
    } >&2
    exit 1
  fi

  # A model's trailer credits the tier; the vmb-agent line links the commit to
  # the agents' GitHub account. Both or neither (docs/agents/git-workflow.md,
  # Co-authoring AI-assisted work).
  agent_address='341066383+vmb-agent@users.noreply.github.com'
  if printf '%s\n' "$well_formed" | grep -vFx "$agent_address" | grep -q . &&
    ! printf '%s\n' "$well_formed" | grep -qFx "$agent_address"; then
    {
      echo "a model's Co-Authored-By trailer needs the vmb-agent line beside it:"
      echo "  Co-Authored-By: vmb-agent <$agent_address>"
      echo "  bypass deliberately with --no-verify"
    } >&2
    exit 1
  fi
fi
