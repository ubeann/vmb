#!/usr/bin/env sh
#
# Validate a commit message against the conventions in docs/agents/git-workflow.md.
#
# Run by lefthook's `commit-msg` hook (issue #62). Enforces a Conventional
# Commits subject, and the shape of the co-author trailer when one is present.
# The repo has no required status checks, so this is the only hard enforcement
# of the message conventions. Bypass deliberately with `--no-verify`.
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

# The trailer is optional (a human commit has none), but if present it must
# match the documented form.
if grep -q '^Co-Authored-By: ' "$msg_file"; then
  if ! grep -Eq '^Co-Authored-By: .+ <noreply@anthropic\.com>$' "$msg_file"; then
    {
      echo "Co-Authored-By trailer must read:"
      echo "  Co-Authored-By: <Model Name> <noreply@anthropic.com>"
      grep -i '^Co-Authored-By:' "$msg_file" >&2
      echo "  bypass deliberately with --no-verify"
    } >&2
    exit 1
  fi
fi
