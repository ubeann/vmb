#!/usr/bin/env bash
#
# Keep the agent account's merges at a human pace (ADR-0059). GitHub's abuse
# detection suspended `vmb-agent` from 2026-10-18 to 2026-10-27, the day the
# repository went public, after bursts of automated writes on a six-day-old
# account: 77 screenshot commits to `vmb-assets` (59 in one hour, ADR-0060)
# and 19 merges. The burst that mattered most is gone with the screenshot
# commits; the reinstatement request also promised a cap on merges a day and
# a gap between them, and this script keeps that promise as a backstop that a
# normal day never reaches: `scripts/merge.sh` asks it before every merge,
# and the dispatcher asks it before launching builds.
#
# Two limits, on merges by PACE_LOGIN (default `vmb-agent`):
#   cap: at most PACE_DAILY_CAP (default 12) merges in a WIB calendar day;
#   gap: at least PACE_GAP_MINUTES (default 15) since the last one.
#
# Usage:
#   scripts/pace.sh                 read recent merges from GitHub and judge
#   scripts/pace.sh --input <file>  judge a saved {now, merges: [{mergedAt,
#                                   mergedBy: {login}}]} document (the tests)
#
# Prints OK and a status line, exit 0; or WAIT and one line a limit, each
# starting `- cap:` or `- gap:`, exit 1. A gap wait clears within the hour;
# a cap wait lasts until 00:00 WIB, so the dispatcher launches nothing on it.
# The GitHub call runs under `timeout` (PACE_TIMEOUT, default 60 s), like
# frontier.sh's. Tests: `bash scripts/pace.test.sh`.

set -euo pipefail

repo=${FRONTIER_REPO:-ubeann/vmb}
cap=${PACE_DAILY_CAP:-12}
gap=${PACE_GAP_MINUTES:-15}
login=${PACE_LOGIN:-vmb-agent}

usage() {
  echo "usage: pace.sh [--input <file>]" >&2
  exit 2
}

case $# in
  0) input="" ;;
  2) [ "$1" = "--input" ] || usage; input=$2 ;;
  *) usage ;;
esac

# GNU `timeout` is coreutils; macOS ships none, and Homebrew installs it as
# `timeout` or `gtimeout` (the same guard as digest.sh).
with_timeout() {
  local secs=$1
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$secs" "$@"
  else
    echo "neither timeout nor gtimeout is on PATH: install coreutils (brew install coreutils) and run again." >&2
    return 127
  fi
}

if [ -n "$input" ]; then
  doc=$(cat "$input")
else
  now=$(date -u +%FT%TZ)
  # The window reaches back to 00:00 WIB (17:00Z the day before) for the cap,
  # or to one gap ago when that is earlier, for the gap.
  since=$(jq -nr --arg now "$now" --argjson gap "$gap" '
    ($now | fromdateiso8601) as $t
    | ((($t + 25200) / 86400 | floor) * 86400 - 25200) as $midnight
    | [$midnight, $t - $gap * 60] | min | todateiso8601')
  merges=$(with_timeout "${PACE_TIMEOUT:-60}" gh api graphql -f query="{
    search(query: \"repo:$repo is:pr is:merged merged:>=$since\", type: ISSUE, first: 100) {
      nodes { ... on PullRequest { mergedAt mergedBy { login } } } } }" \
    --jq '.data.search.nodes')
  doc=$(jq -n --arg now "$now" --argjson merges "$merges" '{now: $now, merges: $merges}')
fi

verdict=$(printf '%s' "$doc" | jq -r --argjson cap "$cap" --argjson gap "$gap" --arg login "$login" '
  # Times print in WIB (UTC+7), the clock the owner reads.
  def wib: . + 25200 | strftime("%H:%M");
  (.now | fromdateiso8601) as $now
  | ((($now + 25200) / 86400 | floor) * 86400 - 25200) as $midnight
  | [.merges[] | select(.mergedBy.login == $login) | .mergedAt | fromdateiso8601] as $times
  | ([$times[] | select(. >= $midnight)] | length) as $today
  | ($times | max) as $last
  | [
      (if $today >= $cap
        then "- cap: \($login) has merged \($today) PRs today, the cap is \($cap); the next merge waits for 00:00 WIB."
        else empty end),
      (if $last != null and $now - $last < $gap * 60
        then "- gap: the last merge was at \($last | wib) WIB, under \($gap) minutes ago; merge after \($last + $gap * 60 | wib) WIB."
        else empty end)
    ] as $waits
  | if ($waits | length) > 0 then "WAIT", $waits[]
    else "OK",
      "Merged today by \($login): \($today) of \($cap); last merge \(if $last == null then "none" else "\($last | wib) WIB" end)."
    end')

printf '%s\n' "$verdict"
[ "$(printf '%s\n' "$verdict" | head -n 1)" = OK ]
