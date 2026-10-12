#!/usr/bin/env bash
#
# Tests for `check-commit-msg.sh`, the `commit-msg` hook: a Conventional
# Commits subject with no trailing `(#n)`, and co-author trailers that are
# well formed, registered, and paired with the vmb-agent line.
#
# Run from anywhere: `bash scripts/check-commit-msg.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the hook or this
# file. The hook is run inside a throwaway repository so a rebase in the
# caller's checkout cannot make it skip.

set -euo pipefail

cd "$(dirname "$0")"
hook=$PWD/check-commit-msg.sh

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

printf '%d checks, %d failures\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
