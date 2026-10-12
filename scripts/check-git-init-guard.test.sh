#!/usr/bin/env bash
#
# Tests for `check-git-init-guard.sh`: a script that creates a repository
# clears git's hook environment first.
#
# Run from anywhere: `bash scripts/check-git-init-guard.test.sh`. CI runs it
# in the `Verify` job, and lefthook runs it on a commit that touches the
# script or this file. The fixtures spell the repository-creating commands in
# pieces, so this file passes the check it tests.

set -euo pipefail

cd "$(dirname "$0")"
check_script=$PWD/check-git-init-guard.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

failures=0
checks=0

command=init
create="git $command -q \"\$tmp/repo\""
# shellcheck disable=SC2016 # the fixture's guard line, kept literal
guard='unset $(git rev-parse --local-env-vars)'

# check <description> <expected exit> <expected output substring|""> <script body>
check() {
  local description=$1 expected_exit=$2 expected_text=$3 body=$4
  local output status=0

  checks=$((checks + 1))
  printf '%s\n' "$body" > "$tmp/fixture.sh"
  output=$("$check_script" "$tmp/fixture.sh" 2>&1) || status=$?
  if [ "$status" -eq "$expected_exit" ] && { [ -z "$expected_text" ] || [[ "$output" == *"$expected_text"* ]]; }; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n' \
      "$description" "$status" "$expected_exit" "$output"
    failures=$((failures + 1))
  fi
}

check "a guarded init passes" 0 "" \
  "$guard
$create"

check "an unguarded init fails and names the line" 1 "fixture.sh:2: creates a repository" \
  "tmp=x
$create"

check "a guard below the init fails" 1 "creates a repository" \
  "$create
$guard"

check "an unguarded clone fails" 1 "creates a repository" \
  "${create/init/clone}"

check "a mention in a comment is not a command" 0 "" \
  "# the throwaway repo comes from $create
echo nothing"

check "a commented-out guard does not count" 1 "creates a repository" \
  "# $guard
$create"

check "a script with no repository command passes" 0 "" \
  'git status
git rev-parse --git-dir'

check "a word ending in git is not the command" 0 "" \
  'lefthook-git init'

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
