#!/usr/bin/env bash
#
# Tests for `check-commit-msg.sh`, the `commit-msg` hook: a Conventional
# Commits subject with no trailing `(#n)`, and co-author trailers that are
# well formed, registered, and paired with the vmb-agent line.
#
# Run from anywhere: `bash scripts/check-commit-msg.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the hook or this
# file. The hook is run inside a throwaway repository so a rebase in the
# caller's checkout cannot make it skip, and git's hook environment is cleared
# first so that repository really is a new one.

set -euo pipefail

cd "$(dirname "$0")"
hook=$PWD/check-commit-msg.sh
self=$PWD/$(basename "$0")

# From a hook, git's GIT_DIR and GIT_INDEX_FILE name the caller's checkout.
# Drop them so `git init` below makes the throwaway repository rather than
# re-initialising the caller's, and the hook reads the throwaway's rebase state.
# shellcheck disable=SC2046 # one variable name per word
unset $(git rev-parse --local-env-vars)

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git init -q "$tmp/repo"

failures=0
checks=0

# check <accepts|rejects> <description> <message>: runs the hook on the message.
check() {
  local want=$1 description=$2 message=$3
  checks=$((checks + 1))
  printf '%s\n' "$message" >"$tmp/msg"
  local got=accepts
  (cd "$tmp/repo" && sh "$hook" "$tmp/msg" >/dev/null 2>&1) || got=rejects
  if [ "$got" = "$want" ]; then
    printf 'ok   %s %s\n' "$want" "$description"
  else
    printf 'FAIL %s %s (hook %s)\n' "$want" "$description" "$got"
    failures=$((failures + 1))
  fi
}

claude='Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
agent='Co-Authored-By: vmb-agent <341066383+vmb-agent@users.noreply.github.com>'

check accepts "a plain Conventional subject" "feat(web): add the thing"
check accepts "a breaking-change subject" "feat(api)!: drop the thing"
check rejects "a subject without a type" "add the thing"
check rejects "an unknown type" "wip: add the thing"
check accepts "a git merge message" "Merge branch 'master' into feature/x"

check rejects "an issue number at the end of the subject" "feat(web): add the thing (#418)"
check rejects "an issue number with trailing space" "feat(web): add the thing (#418) "
check accepts "a number elsewhere in the subject" "feat(web): add the thing (ADR-0049)"
check accepts "an issue number in the body" "$(printf 'feat(web): add the thing\n\n- the thing\n\nRefs: #418')"

check accepts "a human commit with no trailer" "$(printf 'fix(api): a thing\n\n- what changed')"
check accepts "a model trailer with the vmb-agent line" "$(printf 'fix(api): a thing\n\n%s\n%s' "$claude" "$agent")"
check accepts "the vmb-agent line alone" "$(printf 'fix(api): a thing\n\n%s' "$agent")"
check rejects "a model trailer without the vmb-agent line" "$(printf 'fix(api): a thing\n\n%s' "$claude")"
check rejects "an unregistered address" "$(printf 'fix(api): a thing\n\nCo-Authored-By: Bot <bot@example.com>\n%s' "$agent")"
check rejects "a malformed trailer" "$(printf 'fix(api): a thing\n\nCo-Authored-By: Claude noreply@anthropic.com\n%s' "$agent")"

# lefthook runs this file from a hook, where git exports GIT_DIR and
# GIT_INDEX_FILE for the caller's checkout. From a linked worktree GIT_DIR is
# `.git/worktrees/<name>`, and a `git init` that follows it re-initialises the
# shared repository as bare (issue #422). Run this file again that way against
# a stand-in caller, which must come out as the non-bare repository it went in as.
if [ -z "${CHECK_COMMIT_MSG_NESTED:-}" ]; then
  checks=$((checks + 1))
  git init -q "$tmp/caller"
  git -C "$tmp/caller" worktree add -q --orphan -b wt "$tmp/caller-wt"
  wt_git_dir="$tmp/caller/.git/worktrees/caller-wt"
  description="a run from a worktree's hook leaves the caller's repository alone"
  if CHECK_COMMIT_MSG_NESTED=1 GIT_DIR="$wt_git_dir" GIT_INDEX_FILE="$wt_git_dir/index" \
    bash "$self" >/dev/null 2>&1 &&
    [ "$(git -C "$tmp/caller" config core.bare)" = false ]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s (core.bare is %s)\n' "$description" "$(git -C "$tmp/caller" config core.bare)"
    failures=$((failures + 1))
  fi
fi

printf '%d checks, %d failures\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
