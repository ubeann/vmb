#!/usr/bin/env bash
#
# Check that a `ready-for-agent` ticket has the shape an AFK agent can build
# from: the `/to-tickets` sections, at least one acceptance-criterion checkbox,
# exactly one `complexity:*` label, a stated reason when that label is
# `complex`, and no second state label. The contract lives in
# `docs/agents/triage-labels.md` and `docs/agents/ticket-loop.md`.
#
# Run by `.github/workflows/ticket-lint.yml`, which moves a failing ticket back
# to `needs-triage` with the problems as a comment. Tests:
# `bash scripts/ticket-lint.test.sh`.
#
# Usage: scripts/ticket-lint.sh <comma-separated-labels> < issue-body
# Prints one problem per line and exits 1 when there are any. A ticket without
# `ready-for-agent` is not checked.

set -euo pipefail

labels=",${1:?usage: ticket-lint.sh <comma-separated-labels> < body},"
body=$(cat)

case "$labels" in
  *,ready-for-agent,*) ;;
  *) exit 0 ;;
esac

problems=()

# Issue forms render each field as `### Label`; `/to-tickets` writes `## `.
has_heading() {
  printf '%s\n' "$body" | grep -Eiq "^#{2,3}[[:space:]]+$1[[:space:]]*$"
}

for heading in "What to build" "Acceptance criteria" "Blocked by"; do
  has_heading "$heading" || problems+=("Missing a \`## $heading\` section.")
done

# At least one checkbox between the criteria heading and the next heading.
criteria=$(printf '%s\n' "$body" | awk '
  tolower($0) ~ /^#{2,3}[[:space:]]+acceptance criteria[[:space:]]*$/ { inside = 1; next }
  /^#{1,3}[[:space:]]/ { inside = 0 }
  inside && /^[[:space:]]*[-*][[:space:]]+\[[ xX]\][[:space:]]+[^[:space:]]/ { count++ }
  END { print count + 0 }
')
if has_heading "Acceptance criteria" && [ "$criteria" -eq 0 ]; then
  problems+=("\`## Acceptance criteria\` has no \`- [ ]\` checkbox items.")
fi

complexity=$(printf '%s\n' "${labels//,/$'\n'}" | grep -c '^complexity:' || true)
if [ "$complexity" -ne 1 ]; then
  problems+=("Needs exactly one \`complexity:*\` label (trivial, standard or complex); it has $complexity.")
fi
case "$labels" in
  *,complexity:trivial,* | *,complexity:standard,* | *,complexity:complex,*) ;;
  *) [ "$complexity" -eq 1 ] && problems+=("The \`complexity:*\` label must be trivial, standard or complex.") ;;
esac

# The reason is the text under `## Why complex`, up to the next heading.
reason=$(printf '%s\n' "$body" | awk '
  tolower($0) ~ /^#{2,3}[[:space:]]+why complex[[:space:]]*$/ { inside = 1; next }
  /^#{1,3}[[:space:]]/ { inside = 0 }
  inside && /[^[:space:]]/ { count++ }
  END { print count + 0 }
')
case "$labels" in
  *,complexity:complex,*)
    [ "$reason" -gt 0 ] ||
      problems+=("\`complexity:complex\` needs its reason under a \`## Why complex\` heading.")
    ;;
esac

for state in needs-triage needs-info ready-for-human wontfix; do
  case "$labels" in
    *,"$state",*) problems+=("\`ready-for-agent\` conflicts with \`$state\`; keep one state label.") ;;
  esac
done

if [ "${#problems[@]}" -gt 0 ]; then
  printf '%s\n' "${problems[@]}"
  exit 1
fi
