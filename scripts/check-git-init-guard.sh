#!/usr/bin/env bash
#
# A script that creates a repository must first clear git's repository-local
# environment. Lefthook runs the test scripts in `scripts/` from a hook, where
# git exports GIT_DIR and GIT_INDEX_FILE for the caller's checkout, and a
# repository-creating command follows GIT_DIR: from a linked worktree it
# re-initialised the shared repository as bare (#422). The guard is
#
#   unset $(git rev-parse --local-env-vars)
#
# on a line above the first such command. Comment lines are not read.
#
# Run by lefthook on a staged `scripts/**/*.sh` and by CI's Verify job on
# every script. Tests: `bash scripts/check-git-init-guard.test.sh`.
#
# Usage: scripts/check-git-init-guard.sh <script>...
# Prints one problem per line and exits 1 when there are any.

set -euo pipefail

# Line number of the first non-comment line matching a pattern, or nothing.
first_line() {
  grep -nE "$1" "$2" | grep -vE '^[0-9]+:[[:space:]]*#' | head -n 1 | cut -d: -f1 || true
}

problems=()
for file in "$@"; do
  create=$(first_line '(^|[^[:alnum:]_./-])git[[:space:]]+(init|clone)([[:space:]]|$)' "$file")
  [ -n "$create" ] || continue
  guard=$(first_line 'unset[[:space:]].*git rev-parse --local-env-vars' "$file")
  if [ -z "$guard" ] || [ "$guard" -gt "$create" ]; then
    problems+=("$file:$create: creates a repository without 'unset \$(git rev-parse --local-env-vars)' above it")
  fi
done

if [ "${#problems[@]}" -gt 0 ]; then
  printf '%s\n' "${problems[@]}"
  exit 1
fi
