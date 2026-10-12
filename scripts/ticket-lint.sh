#!/usr/bin/env bash
#
# Check that a `ready-for-agent` ticket has the shape an AFK agent can build
# from: the `/to-tickets` sections (the bug form's for a `bug` ticket, the
# research form's for a `research` ticket), at least one checkbox in its
# checklist, exactly one `complexity:*`
# label, a stated reason when that label is `complex`, and no second state
# label. The contract lives in
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
  grep -Eiq "^#{2,3}[[:space:]]+$1[[:space:]]*$" <<<"$body"
}

# A `research` ticket answers questions rather than building something: its
# sections are the research issue form's, and its checklist is the questions.
# A `bug` ticket says what to fix rather than what to build: the bug form's
# `What's wrong` is where the reproduction lives, but a ticket written from a
# known cause folds it into the fix, so only `What to fix` is required.
case "$labels" in
  *,research,*)
    headings=("What to find out" "Questions" "Done when" "Blocked by")
    checklist="Questions"
    ;;
  *,bug,*)
    headings=("What to fix" "Acceptance criteria" "Blocked by")
    checklist="Acceptance criteria"
    ;;
  *)
    headings=("What to build" "Acceptance criteria" "Blocked by")
    checklist="Acceptance criteria"
    ;;
esac

for heading in "${headings[@]}"; do
  has_heading "$heading" || problems+=("Missing a \`## $heading\` section.")
done

# At least one checkbox between the checklist heading and the next heading.
items=$(printf '%s\n' "$body" | awk -v heading="$checklist" '
  tolower($0) ~ ("^#{2,3}[[:space:]]+" tolower(heading) "[[:space:]]*$") { inside = 1; next }
  /^#{1,3}[[:space:]]/ { inside = 0 }
  inside && /^[[:space:]]*[-*][[:space:]]+\[[ xX]\][[:space:]]+[^[:space:]]/ { count++ }
  END { print count + 0 }
')
if has_heading "$checklist" && [ "$items" -eq 0 ]; then
  problems+=("\`## $checklist\` has no \`- [ ]\` checkbox items.")
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
