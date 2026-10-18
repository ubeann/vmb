#!/usr/bin/env bash
#
# Tests for `ci-failed.sh`, the reader for a PR's red checks. Each case feeds a
# saved {head, checks, jobs} document or a saved job log and checks one rule:
# the exit code per state, which annotations show, and the step filter.
#
# Run from anywhere: `bash scripts/ci-failed.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the script or
# this file.

set -euo pipefail

cd "$(dirname "$0")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

failures=0
checks=0

doc=$(jq -n '{
  head: "992606a",
  checks: [
    {name: "Verify", status: "COMPLETED", conclusion: "SUCCESS",
     url: "https://github.com/ubeann/vmb/actions/runs/1/job/11"},
    {name: "Preview", status: "COMPLETED", conclusion: "SKIPPED",
     url: "https://github.com/ubeann/vmb/actions/runs/2/job/22"}
  ],
  jobs: []
}')

# check <description> <expected exit> <expected output substring> <jq edit>
check() {
  local description=$1 expected_exit=$2 expected=$3 edit=$4
  local output status=0

  checks=$((checks + 1))
  printf '%s' "$doc" | jq "$edit" >"$tmp/doc.json"
  output=$(bash ci-failed.sh --input "$tmp/doc.json" 2>&1) || status=$?
  if [ "$status" -eq "$expected_exit" ] && [[ "$output" == *"$expected"* ]]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n' \
      "$description" "$status" "$expected_exit" "$output"
    failures=$((failures + 1))
  fi
}

# refute <description> <unexpected output substring> <jq edit>
refute() {
  local description=$1 unexpected=$2 edit=$3
  local output status=0

  checks=$((checks + 1))
  printf '%s' "$doc" | jq "$edit" >"$tmp/doc.json"
  output=$(bash ci-failed.sh --input "$tmp/doc.json" 2>&1) || status=$?
  if [[ "$output" != *"$unexpected"* ]]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       output: %s\n' "$description" "$output"
    failures=$((failures + 1))
  fi
}

check "every check green exits 0" 0 "checks: 0 failed, 0 pending, 2 green" '.'
check "the head commit is printed" 0 "head: 992606a" '.'
check "a running check exits 3 and is named" 3 "pending: Verify" \
  '.checks[0].status = "IN_PROGRESS" | .checks[0].conclusion = ""'
check "an external status context counts by its state" 0 "0 pending, 2 green" \
  '.checks[0] = {name: "cloudflare/pages", status: "COMPLETED", conclusion: "SUCCESS", url: ""}'

failed='.checks[0].conclusion = "FAILURE" | .jobs = [{
  id: 11, name: "Verify", url: "https://github.com/ubeann/vmb/actions/runs/1/job/11",
  failed_steps: ["Knip"],
  annotations: [
    {path: ".github", line: 17, level: "failure", title: "", message: "Process completed with exit code 1."},
    {path: "packages/types/src/users.ts", line: 1, level: "failure", title: "Knip / Duplicate exports",
     message: "DivisionFilterSchema|RoleFilterSchema in packages/types/src/users.ts"},
    {path: ".github", line: 1, level: "notice", title: "", message: "The ubuntu-latest label will migrate"}
  ]
}]'
check "a failed check exits 1" 1 "checks: 1 failed, 0 pending, 1 green" "$failed"
check "the failed check is named with its url" 1 "failed: Verify (https://github.com/ubeann/vmb/actions/runs/1/job/11)" "$failed"
check "the failing step is named" 1 "failed step: Knip" "$failed"
check "a titled annotation shows path, line, title and message" 1 \
  "annotation: packages/types/src/users.ts:1 Knip / Duplicate exports: DivisionFilterSchema|RoleFilterSchema" "$failed"
check "an untitled annotation shows path, line and message" 1 \
  "annotation: .github:17 Process completed with exit code 1." "$failed"
refute "a notice annotation is left out" "ubuntu-latest" "$failed"
check "a cancelled check counts as failed" 1 "checks: 1 failed" '.checks[0].conclusion = "CANCELLED"'

# The step filter: `gh run view --job --log` lines are `<job>\t<step>\t<ts> <line>`;
# the first line of a step carries a byte-order mark before its timestamp.
checks=$((checks + 1))
printf 'Verify\tFormat\t2026-10-17T17:41:56.2460703Z ##[group]Run pnpm turbo format:check\nVerify\tKnip\t\xEF\xBB\xBF2026-10-17T17:42:14.6749248Z ##[group]Run pnpm knip\nVerify\tKnip\t2026-10-17T17:42:19.5280627Z ##[error]Duplicate export\nVerify\tReal Postgres\t2026-10-17T17:42:19.7300145Z ##[group]Run pnpm turbo test\n' >"$tmp/job.log"
expected=$'##[group]Run pnpm knip\n##[error]Duplicate export'
output=$(bash ci-failed.sh --filter Knip <"$tmp/job.log")
if [ "$output" = "$expected" ]; then
  printf 'ok   %s\n' "the step filter keeps one step's lines and strips the prefixes"
else
  printf 'FAIL %s\n       output: %s\n' "the step filter keeps one step's lines and strips the prefixes" "$output"
  failures=$((failures + 1))
fi

checks=$((checks + 1))
if bash ci-failed.sh --input "$tmp/doc.json" --job 1 >/dev/null 2>&1; then
  printf 'FAIL %s\n' "--input and --job together are refused"
  failures=$((failures + 1))
else
  printf 'ok   %s\n' "--input and --job together are refused"
fi

printf '\n%s checks, %s failures\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
