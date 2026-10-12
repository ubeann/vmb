#!/usr/bin/env bash
#
# Print the dispatcher's view of the ticket queue (`docs/agents/ticket-loop.md`,
# Dispatcher): the builds in flight, the free slots, and the frontier — the
# unassigned `ready-for-agent` tickets with no open blocker that pass
# `ticket-lint.sh`, open milestone first, lowest number first. One GraphQL call
# fetches every ticket with its labels, assignee, milestone and dependencies;
# the agent reads one result instead of making a `gh` call per ticket.
#
# Usage:
#   scripts/frontier.sh [--slots N]       fetch from GitHub and print (N defaults to 2)
#   scripts/frontier.sh --input <file>    judge a saved {issues, referenced, milestones}
#                                         document (what the tests use)
#   git show origin/master:scripts/frontier.sh | bash
#                                         from a checkout that may be behind; the
#                                         script then reads ticket-lint.sh from
#                                         origin/master too
#
# Output, one block per section:
#   in-flight: <count> (#n …)
#   slots: <free> of <total> free
#   frontier:
#     #n  <tier>  <type>  <title>
#   dropped:
#     #n  <reason>
#
# <tier> is the model tier for the ticket's `complexity:*` label
# (`model-routing.md`); <type> is the branch prefix (`git-workflow.md`): `fix`
# for a `bug`, `docs` for a `research` ticket, `feature` otherwise.
# Tests: `bash scripts/frontier.test.sh`.

set -euo pipefail

repo=${FRONTIER_REPO:-ubeann/vmb}
slots=2
input=""

while [ $# -gt 0 ]; do
  case "$1" in
    --slots)
      slots=${2:?--slots needs a number}
      shift 2
      ;;
    --input)
      input=${2:?--input needs a file}
      shift 2
      ;;
    *)
      echo "usage: frontier.sh [--slots N] | frontier.sh --input <file>" >&2
      exit 2
      ;;
  esac
done

# ticket-lint.sh sits beside this file. When the script is piped from
# `git show`, there is no file beside it, so take the lint from origin/master.
lint="$(dirname "${BASH_SOURCE[0]:-$0}")/ticket-lint.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ ! -f "$lint" ]; then
  git show origin/master:scripts/ticket-lint.sh >"$tmp/ticket-lint.sh"
  lint="$tmp/ticket-lint.sh"
fi

fetch() {
  local owner name issues numbers aliases referenced
  owner=${repo%/*}
  name=${repo#*/}
  # shellcheck disable=SC2016 # the $variables are GraphQL's, bound with -F
  issues=$(gh api graphql -F owner="$owner" -F name="$name" -f query='
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        issues(labels: ["ready-for-agent"], states: OPEN, first: 100,
               orderBy: {field: CREATED_AT, direction: ASC}) {
          nodes {
            number title body
            labels(first: 20) { nodes { name } }
            assignees(first: 5) { nodes { login } }
            milestone { title state }
            blockedBy(first: 20) { nodes { number state } }
          }
        }
        milestones(states: OPEN, first: 5) {
          nodes { title
            open: issues(states: OPEN) { totalCount }
            closed: issues(states: CLOSED) { totalCount } }
        }
      }
    }')

  # A ticket can also name a blocker in its `## Blocked by` section; those
  # numbers are looked up in one aliased query.
  numbers=$(printf '%s' "$issues" | jq -r '
    .data.repository.issues.nodes[].body // "" |
    split("\n") |
    (index(map(select(test("^#{2,3}[[:space:]]+blocked by[[:space:]]*$"; "i")))) // -1) as $start |
    if $start < 0 then [] else
      .[$start + 1:] |
      (index(map(select(test("^#{1,3}[[:space:]]")))) // length) as $end |
      .[:$end] | map(match("#([0-9]+)"; "g").captures[0].string) end |
    .[]' | sort -un)
  referenced="{}"
  if [ -n "$numbers" ]; then
    aliases=""
    for n in $numbers; do
      aliases+="i$n: issue(number: $n) { number state } "
    done
    referenced=$(gh api graphql -F owner="$owner" -F name="$name" -f query="
      query(\$owner: String!, \$name: String!) {
        repository(owner: \$owner, name: \$name) { $aliases }
      }" | jq '[.data.repository[] | select(. != null)] | map({(.number | tostring): .state}) | add // {}')
  fi

  printf '%s' "$issues" | jq --argjson referenced "$referenced" '{
    issues: .data.repository.issues.nodes,
    milestones: .data.repository.milestones.nodes,
    referenced: $referenced
  }'
}

if [ -n "$input" ]; then
  doc=$(cat "$input")
else
  doc=$(fetch)
fi

# Everything but the lint is decided in jq: in flight, blocked, order.
judged=$(printf '%s' "$doc" | jq '
  def labels: [.labels.nodes[].name];
  def tier:
    if (labels | index("complexity:trivial")) then "fast"
    elif (labels | index("complexity:standard")) then "daily"
    elif (labels | index("complexity:complex")) then "frontier"
    else "-" end;
  def type:
    if (labels | index("bug")) then "fix"
    elif (labels | index("research")) then "docs"
    else "feature" end;
  def body_blockers:
    (.body // "") | split("\n") |
    (index(map(select(test("^#{2,3}[[:space:]]+blocked by[[:space:]]*$"; "i")))) // -1) as $start |
    if $start < 0 then [] else
      .[$start + 1:] |
      (index(map(select(test("^#{1,3}[[:space:]]")))) // length) as $end |
      .[:$end] | map(match("#([0-9]+)"; "g").captures[0].string | tonumber) end;
  .referenced as $referenced |
  .issues | map(
    . + {
      tier: tier, type: type,
      labels: (labels | join(",")),
      assigned: ((.assignees.nodes | length) > 0),
      blockers: ([.blockedBy.nodes[] | select(.state == "OPEN") | .number]
                 + [body_blockers[] | select($referenced[tostring] == "OPEN")]
                 | unique),
      in_milestone: (.milestone != null and .milestone.state == "OPEN")
    })
  | sort_by((if .in_milestone then 0 else 1 end), .number)')

in_flight=$(printf '%s' "$judged" | jq -r '[.[] | select(.assigned) | .number] | if length == 0 then "0" else "\(length) (\(map("#\(.)") | join(" ")))" end')
in_flight_count=${in_flight%% *}
free=$((slots - in_flight_count))
[ "$free" -lt 0 ] && free=0

printf 'in-flight: %s\n' "$in_flight"
printf 'slots: %s of %s free\n' "$free" "$slots"

frontier=()
dropped=()
while IFS=$'\t' read -r number tier type blockers labels title; do
  if [ "$blockers" != "-" ]; then
    dropped+=("#$number  blocked by $blockers")
    continue
  fi
  if ! problems=$(printf '%s' "$doc" | jq -r --argjson n "$number" '.issues[] | select(.number == $n) | .body // ""' | bash "$lint" "$labels"); then
    dropped+=("#$number  lint: $(printf '%s' "$problems" | tr '\n' ' ')")
    continue
  fi
  frontier+=("#$number  $tier  $type  $title")
done < <(printf '%s' "$judged" | jq -r '
  .[] | select(.assigned | not) |
  [.number, .tier, .type, (.blockers | if length == 0 then "-" else map("#\(.)") | join(" ") end), .labels, .title] | @tsv')

printf 'frontier:\n'
for line in ${frontier[@]+"${frontier[@]}"}; do printf '  %s\n' "$line"; done
printf 'dropped:\n'
for line in ${dropped[@]+"${dropped[@]}"}; do printf '  %s\n' "$line"; done

printf '%s' "$doc" | jq -r '.milestones[]? | "milestone: \(.title): \(.closed.totalCount) closed of \(.closed.totalCount + .open.totalCount)"'
