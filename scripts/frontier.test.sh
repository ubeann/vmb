#!/usr/bin/env bash
#
# Tests for `frontier.sh`, the dispatcher's view of the ticket queue. Each case
# starts from a saved queue and checks one rule: slots, blockers from both
# sources, lint, and order.
#
# Run from anywhere: `bash scripts/frontier.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the script or
# this file.

set -euo pipefail

cd "$(dirname "$0")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

failures=0
checks=0

body='## What to build\n\nA thing.\n\n## Acceptance criteria\n\n- [ ] It works\n\n## Blocked by\n\nNone.'

queue=$(jq -n --arg body "$(printf '%b' "$body")" '{
  milestones: [{title: "Focus", open: {totalCount: 2}, closed: {totalCount: 3}}],
  referenced: {"7": "OPEN", "8": "CLOSED"},
  issues: [
    {number: 20, title: "Outside the milestone", body: $body,
     labels: {nodes: [{name: "ready-for-agent"}, {name: "complexity:trivial"}]},
     assignees: {nodes: []}, milestone: null, blockedBy: {nodes: []}},
    {number: 30, title: "In flight", body: $body,
     labels: {nodes: [{name: "ready-for-agent"}, {name: "complexity:standard"}]},
     assignees: {nodes: [{login: "vmb-agent"}]}, milestone: {title: "Focus", state: "OPEN"}, blockedBy: {nodes: []}},
    {number: 40, title: "A bug in the milestone", body: $body,
     labels: {nodes: [{name: "ready-for-agent"}, {name: "bug"}, {name: "complexity:standard"}]},
     assignees: {nodes: []}, milestone: {title: "Focus", state: "OPEN"}, blockedBy: {nodes: []}},
    {number: 50, title: "Blocked by a dependency", body: $body,
     labels: {nodes: [{name: "ready-for-agent"}, {name: "complexity:complex"}]},
     assignees: {nodes: []}, milestone: {title: "Focus", state: "OPEN"},
     blockedBy: {nodes: [{number: 30, state: "OPEN"}, {number: 8, state: "CLOSED"}]}},
    {number: 60, title: "Blocked by a line in the body",
     body: ($body | sub("None."; "- #7\n- #8")),
     labels: {nodes: [{name: "ready-for-agent"}, {name: "complexity:standard"}]},
     assignees: {nodes: []}, milestone: {title: "Focus", state: "OPEN"}, blockedBy: {nodes: []}},
    {number: 70, title: "Fails lint", body: $body,
     labels: {nodes: [{name: "ready-for-agent"}]},
     assignees: {nodes: []}, milestone: {title: "Focus", state: "OPEN"}, blockedBy: {nodes: []}}
  ]
}')

# check <description> <expected output substring> <jq edit>
check() {
  local description=$1 expected=$2 edit=$3
  local output status=0

  checks=$((checks + 1))
  printf '%s' "$queue" | jq "$edit" >"$tmp/queue.json"
  output=$(bash frontier.sh --input "$tmp/queue.json" 2>&1) || status=$?
  if [ "$status" -eq 0 ] && [[ "$output" == *"$expected"* ]]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s\n       expected: %s\n       output:\n%s\n' \
      "$description" "$status" "$expected" "$output"
    failures=$((failures + 1))
  fi
}

check "an assigned ticket is in flight and takes a slot" $'in-flight: 1 (#30)\nslots: 1 of 2 free' '.'

check "the milestone ticket comes before the lower number outside it" \
  $'frontier:\n  #40  daily  fix  A bug in the milestone\n  #20  fast  feature  Outside the milestone\n' '.'

check "an open dependency drops the ticket, a closed one does not" "#50  blocked by #30" '.'

check "an open issue on a Blocked by line drops the ticket, a closed one does not" "#60  blocked by #7" '.'

check "a lint failure names the problem" "#70  lint: Needs exactly one \`complexity:*\` label" '.'

check "a closed milestone does not order first" \
  $'frontier:\n  #20  fast  feature  Outside the milestone\n  #40  daily  fix  A bug in the milestone\n' \
  '(.issues[] | select(.milestone != null) | .milestone.state) = "CLOSED"'

check "no slot is free when the builds in flight fill them" "slots: 0 of 2 free" \
  '.issues[0].assignees.nodes = [{login: "vmb-agent"}]'

check "milestone progress is reported" "milestone: Focus: 3 closed of 5" '.'

printf '\n%s checks, %s failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
