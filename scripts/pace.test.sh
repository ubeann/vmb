#!/usr/bin/env bash
#
# Tests for `pace.sh`: the daily cap counts the agent's merges in the WIB
# calendar day only, the gap measures from the last merge whatever the day,
# other people's merges never count, and each limit names itself so the
# dispatcher can tell a cap from a gap.
#
# Run from anywhere: `bash scripts/pace.test.sh`. CI runs it in the `Verify`
# job, and lefthook runs it on a commit that touches the script or this file.

set -euo pipefail

cd "$(dirname "$0")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

failures=0
checks=0

# check <description> <expected exit> <expected output substring> <now> <merges JSON> [<VAR=value>]
check() {
  local description=$1 expected_exit=$2 expected_text=$3 now=$4 merges=$5 env=${6:-}
  local output status=0
  checks=$((checks + 1))
  jq -n --arg now "$now" --argjson merges "$merges" '{now: $now, merges: $merges}' >"$tmp/doc.json"
  output=$(env ${env:+"$env"} bash pace.sh --input "$tmp/doc.json" 2>&1) || status=$?
  if [ "$status" -eq "$expected_exit" ] && [[ "$output" == *"$expected_text"* ]]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n' \
      "$description" "$status" "$expected_exit" "$output"
    failures=$((failures + 1))
  fi
}

# merges <login> <time>... prints a merges array.
merges() {
  local who=$1
  shift
  printf '%s\n' "$@" | jq -R --arg who "$who" '{mergedAt: ., mergedBy: {login: $who}}' | jq -s .
}

# 2026-10-28 12:00 WIB is 05:00Z; that WIB day began at 2026-10-27T17:00Z.
now=2026-10-28T05:00:00Z
# Twelve merges on 2026-10-28 WIB, from 00:05 to 11:00 WIB, an hour apart at most.
day=(2026-10-27T17:05:00Z 2026-10-27T18:00:00Z 2026-10-27T19:00:00Z 2026-10-27T20:00:00Z
  2026-10-27T21:00:00Z 2026-10-27T22:00:00Z 2026-10-27T23:00:00Z 2026-10-28T00:00:00Z
  2026-10-28T01:00:00Z 2026-10-28T02:00:00Z 2026-10-28T03:00:00Z 2026-10-28T04:00:00Z)

check "no merges yet is OK" 0 "Merged today by vmb-agent: 0 of 12; last merge none." \
  "$now" '[]'

check "half an hour after a merge is OK" 0 "1 of 12; last merge 11:30 WIB." \
  "$now" "$(merges vmb-agent 2026-10-28T04:30:00Z)"

check "a merge 10 minutes ago waits for the gap" 1 \
  "- gap: the last merge was at 11:50 WIB, under 15 minutes ago; merge after 12:05 WIB." \
  "$now" "$(merges vmb-agent 2026-10-28T04:50:00Z)"

check "twelve merges today hit the cap" 1 \
  "- cap: vmb-agent has merged 12 PRs today, the cap is 12; the next merge waits for 00:00 WIB." \
  "$now" "$(merges vmb-agent "${day[@]}")"

check "eleven merges today leave one" 0 "11 of 12" \
  "$now" "$(merges vmb-agent "${day[@]:1}")"

check "merges before 00:00 WIB do not count against today" 0 "0 of 12" \
  "$now" "$(merges vmb-agent 2026-10-27T10:00:00Z 2026-10-27T11:00:00Z 2026-10-27T12:00:00Z \
    2026-10-27T13:00:00Z 2026-10-27T14:00:00Z 2026-10-27T15:00:00Z 2026-10-27T16:00:00Z \
    2026-10-27T16:10:00Z 2026-10-27T16:20:00Z 2026-10-27T16:30:00Z 2026-10-27T16:40:00Z 2026-10-27T16:45:00Z)"

check "the gap reaches across 00:00 WIB" 1 "- gap: the last merge was at 23:55 WIB" \
  "2026-10-27T17:05:00Z" "$(merges vmb-agent 2026-10-27T16:55:00Z)"

check "the owner's merges never count" 0 "0 of 12" \
  "$now" "$(merges ubeann 2026-10-28T04:50:00Z 2026-10-28T04:55:00Z)"

check "a cap and a gap both print" 1 "- gap:" \
  "$now" "$(merges vmb-agent "${day[@]}" 2026-10-28T04:55:00Z)"

check "the limits are overridable" 1 "the cap is 1;" \
  "$now" "$(merges vmb-agent 2026-10-28T03:00:00Z)" PACE_DAILY_CAP=1

checks=$((checks + 1))
status=0
bash pace.sh --input 2>/dev/null || status=$?
if [ "$status" -eq 2 ]; then
  printf 'ok   %s\n' "--input without a file is a usage error"
else
  printf 'FAIL %s\n       exit: %s (expected 2)\n' "--input without a file is a usage error" "$status"
  failures=$((failures + 1))
fi

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
