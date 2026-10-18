#!/usr/bin/env bash
#
# Tests for `check-bash-wait.sh`, the hook that refuses a Bash command that
# waits by polling. Each refused shape comes from a real command in a thread
# between 10 and 18 October 2026; the passing ones are ordinary work.
#
# Run from anywhere: `bash scripts/check-bash-wait.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the script or
# this file.

set -euo pipefail

cd "$(dirname "$0")"

failures=0
checks=0

# check <description> <expected exit> <command>
check() {
  local description=$1 expected_exit=$2 cmd=$3
  local output status=0
  checks=$((checks + 1))
  output=$(bash check-bash-wait.sh --command "$cmd" 2>&1) || status=$?
  if [ "$status" -eq "$expected_exit" ] && { [ "$expected_exit" -eq 0 ] || [[ "$output" == *"Refused"* ]]; }; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n' \
      "$description" "$status" "$expected_exit" "$output"
    failures=$((failures + 1))
  fi
}

# hook_check <description> <expected exit> <json>
hook_check() {
  local description=$1 expected_exit=$2 json=$3
  local status=0
  checks=$((checks + 1))
  printf '%s' "$json" | bash check-bash-wait.sh >/dev/null 2>&1 || status=$?
  if [ "$status" -eq "$expected_exit" ]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n' "$description" "$status" "$expected_exit"
    failures=$((failures + 1))
  fi
}

check "a leading sleep is refused" 2 "sleep 240"
check "a sleep after a semicolon is refused" 2 "gh pr view 482 --json mergeable; sleep 20; gh pr view 482 --json mergeable"
check "a sleep inside a loop is refused" 2 'for i in 1 2 3 4 5; do gh pr checks 485; sleep 4; done'
check "a sleep after && is refused" 2 'git push && sleep 90 && gh pr checks 487'
check "gh pr checks --watch is refused" 2 "timeout 560 gh pr checks 482 --watch"
check "gh run watch is refused" 2 "gh run watch 39127251067"
# shellcheck disable=SC2016 # the commands under test are quoted verbatim
check "an until loop over gh pr checks is refused" 2 'until s=$(gh pr checks 475 2>&1) && ! grep -q pending <<<"$s"; do sleep 30; done'
# shellcheck disable=SC2016
check "a for loop over gh api is refused" 2 'for i in $(seq 1 16); do now=$(gh api repos/ubeann/vmb/pulls/487/reviews --jq length); echo "$now"; done'
check "a while loop over gh run is refused" 2 'while true; do gh run list --limit 1; done'
check "gh in the loop condition is refused" 2 'until gh pr checks 475; do :; done'
check "a loop split across lines is refused" 2 $'until gh pr checks 475\ndo\n  :\ndone'
check "a sleep by full path is refused" 2 "/bin/sleep 2"
# shellcheck disable=SC2016
check "a sleep with a variable duration is refused" 2 'n=30; sleep "$n"'
check "a sleep with a fractional duration is refused" 2 "sleep .5; echo done"
check "a redirect before the watch flag is still refused" 2 "gh pr checks 482 2>&1 --watch"
check "a pause split by a line continuation is refused" 2 $'sleep\\\n 2'
check "a pause escaped past an alias is refused" 2 '\sleep 2'
check "a watch flag split by a line continuation is refused" 2 $'gh pr checks 482 \\\n  --watch'

check "a plain gh pr checks passes" 0 "gh pr checks 485"
check "ci-failed.sh passes" 0 "scripts/ci-failed.sh 485"
check "a test run passes" 0 "pnpm --filter @vmb/web test src/lib/nav.test.ts"
# shellcheck disable=SC2016
check "a for loop over files passes" 0 'for f in scripts/*.sh; do shellcheck "$f"; done'
# shellcheck disable=SC2016
check "a for loop over a fixed list of PRs passes" 0 'for n in 495 506; do gh pr view "$n" --json isDraft; done'
# shellcheck disable=SC2016
check "a for loop over a seq that calls gh is refused" 2 'for i in $(seq 1 55); do gh pr checks 485; done'
check "a word containing sleep passes" 0 "grep -rn asleep docs/"
check "a timeout around one gh call passes" 0 "timeout 60 gh api graphql -f query='{ viewer { login } }'"
check "an empty command passes" 0 ""

hook_check "the hook reads tool_input.command from stdin" 2 '{"tool_name":"Bash","tool_input":{"command":"sleep 45; cat /tmp/out"}}'
hook_check "the hook lets an ordinary command through" 0 '{"tool_name":"Bash","tool_input":{"command":"git status"}}'
hook_check "the hook ignores a call with no command" 0 '{"tool_name":"Bash","tool_input":{}}'

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
