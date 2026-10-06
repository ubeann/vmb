#!/usr/bin/env bash
#
# Tests for `ticket-lint.sh`, the shape check on `ready-for-agent` tickets.
#
# Run from anywhere: `bash scripts/ticket-lint.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the script or
# this file.

set -euo pipefail

cd "$(dirname "$0")"

failures=0
checks=0

# check <description> <expected exit> <expected output substring|""> <labels> <body>
check() {
  local description=$1 expected_exit=$2 expected_text=$3 labels=$4 body=$5
  local output status=0

  checks=$((checks + 1))
  output=$(printf '%s' "$body" | bash ticket-lint.sh "$labels" 2>&1) || status=$?
  if [ "$status" -eq "$expected_exit" ] && { [ -z "$expected_text" ] || [[ "$output" == *"$expected_text"* ]]; }; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n' \
      "$description" "$status" "$expected_exit" "$output"
    failures=$((failures + 1))
  fi
}

good='## Parent

#172

## What to build

Users see the list.

## Acceptance criteria

- [ ] The list renders
- [ ] It pages

## Blocked by

None (can start immediately)'

form='### What to build

Users see the list.

### Acceptance criteria

- [ ] The list renders

### Blocked by

None'

check "a /to-tickets ticket passes" 0 "" \
  "enhancement,ready-for-agent,complexity:standard" "$good"

check "an issue-form ticket (### headings) passes" 0 "" \
  "ready-for-agent,complexity:trivial" "$form"

check "a ticket that is not ready-for-agent is not checked" 0 "" \
  "needs-triage" "no sections at all"

check "a missing section is named" 1 "Missing a \`## Blocked by\` section." \
  "ready-for-agent,complexity:standard" "${good%%## Blocked by*}"

check "criteria without checkboxes fail" 1 "has no \`- [ ]\` checkbox items" \
  "ready-for-agent,complexity:standard" \
  '## What to build

x

## Acceptance criteria

The list renders.

## Blocked by

None'

check "a checkbox outside the criteria section does not count" 1 "has no \`- [ ]\` checkbox items" \
  "ready-for-agent,complexity:standard" \
  '## What to build

- [ ] not a criterion

## Acceptance criteria

## Blocked by

None'

check "no complexity label fails" 1 "it has 0" \
  "ready-for-agent" "$good"

check "two complexity labels fail" 1 "it has 2" \
  "ready-for-agent,complexity:standard,complexity:complex" "$good"

check "an unknown complexity value fails" 1 "must be trivial, standard or complex" \
  "ready-for-agent,complexity:simple" "$good"

check "complex without a reason fails" 1 "## Why complex" \
  "ready-for-agent,complexity:complex" "$good"

check "complex with a reason passes" 0 "" \
  "ready-for-agent,complexity:complex" "$good

## Why complex

It sets the list design every later module follows."

check "a second state label conflicts" 1 "conflicts with \`needs-info\`" \
  "ready-for-agent,needs-info,complexity:standard" "$good"

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
