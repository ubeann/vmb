#!/usr/bin/env bash
#
# Gather the morning digest (`docs/agents/ticket-loop.md`, Morning digest) in
# one GraphQL call plus `frontier.sh`, and print its sections 1–5 as text. The
# agent that runs the digest reads this output, adds the review guides (section
# 6, a T3 call) and posts it. Read only: it changes nothing on GitHub.
#
# Usage:
#   scripts/digest.sh [--since <ISO-8601 UTC>]
#       The cutoff defaults to 17:00 WIB yesterday, when the night windows open.
#   git show origin/master:scripts/digest.sh | bash
#       From a checkout that may be behind; frontier.sh and ticket-lint.sh are
#       then read from origin/master too.
#
# Sections, in the digest's order:
#   decide:   open PRs labelled needs-decision, each with the question from its
#             decision brief
#   merged:   PRs merged since the cutoff, with the ticket each closed
#   bounced:  tickets labelled needs-triage since the cutoff (not ones filed
#             with the label), with their last comment
#   stalled:  claimed ready-for-agent tickets with no open PR, claimed more
#             than 6 hours ago, with the thread id from the claim comment
#   next up:  frontier.sh's output, then how many ready-for-agent tickets fail
#             ticket-lint
#   guides:   the PR numbers under decide, for write_pull_request_guides

set -euo pipefail

repo=${FRONTIER_REPO:-ubeann/vmb}
since=""

while [ $# -gt 0 ]; do
  case "$1" in
    --since)
      since=${2:?--since needs an ISO-8601 UTC time}
      shift 2
      ;;
    *)
      echo "usage: digest.sh [--since <ISO-8601 UTC>]" >&2
      exit 2
      ;;
  esac
done

if [ -z "$since" ]; then
  # 17:00 WIB (UTC+7) yesterday is 10:00Z yesterday. BSD date first (macOS),
  # then GNU.
  yesterday=$(TZ=Asia/Jakarta date -v-1d +%F 2>/dev/null || TZ=Asia/Jakarta date -d yesterday +%F)
  since="${yesterday}T10:00:00Z"
fi

# frontier.sh sits beside this file. When the script is piped from `git show`,
# there is no file beside it, so take it from origin/master.
frontier="$(dirname "${BASH_SOURCE[0]:-$0}")/frontier.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ ! -f "$frontier" ]; then
  git show origin/master:scripts/frontier.sh >"$tmp/frontier.sh"
  frontier="$tmp/frontier.sh"
fi

# Search strings cannot take GraphQL variables, so they are built here.
q() { printf 'search(query: "repo:%s %s", type: ISSUE, first: %s)' "$repo" "$1" "$2"; }
doc=$(gh api graphql -f query="{
  decide: $(q 'is:pr is:open label:needs-decision' 20) {
    nodes { ... on PullRequest {
      number title url
      comments(last: 30) { nodes { body createdAt } } } }
  }
  merged: $(q "is:pr is:merged merged:>=$since" 50) {
    nodes { ... on PullRequest {
      number title mergedAt
      closingIssuesReferences(first: 5) { nodes { number } } } }
  }
  bounced: $(q "is:issue is:open label:needs-triage updated:>=$since" 50) {
    nodes { ... on Issue {
      number title createdAt
      timelineItems(last: 10, itemTypes: [LABELED_EVENT]) {
        nodes { ... on LabeledEvent { createdAt label { name } } } }
      comments(last: 1) { nodes { body createdAt } } } }
  }
  claimed: $(q 'is:issue is:open label:ready-for-agent' 100) {
    nodes { ... on Issue {
      number title
      assignees(first: 1) { nodes { login } }
      timelineItems(last: 5, itemTypes: [ASSIGNED_EVENT]) {
        nodes { ... on AssignedEvent { createdAt } } }
      comments(last: 20) { nodes { body } } } }
  }
  openprs: $(q 'is:pr is:open' 50) {
    nodes { ... on PullRequest {
      number closingIssuesReferences(first: 5) { nodes { number } } } }
  }
}")

printf 'since: %s\n\n' "$since"

printf 'decide:\n'
printf '%s' "$doc" | jq -r '
  .data.decide.nodes[] |
  ([.comments.nodes[] | select(.body | test("Decision brief")) | .body
    | capture("\\*\\*Your question:\\*\\*[[:space:]]*(?<q>[^\n]*)").q] | last // "no decision brief found") as $q |
  "  #\(.number)  \(.title)\n    question: \($q)"'

printf '\nmerged:\n'
printf '%s' "$doc" | jq -r '
  .data.merged.nodes | sort_by(.mergedAt) | reverse | .[] |
  "  #\(.number)  \(.title)  closes \(if (.closingIssuesReferences.nodes | length) == 0 then "nothing"
     else (.closingIssuesReferences.nodes | map("#\(.number)") | join(" ")) end)"'

printf '\nbounced:\n'
printf '%s' "$doc" | jq -r --arg since "$since" '
  .data.bounced.nodes[] |
  (.createdAt | fromdateiso8601) as $created |
  ([.timelineItems.nodes[] | select(.label.name == "needs-triage" and .createdAt >= $since)
    | select((.createdAt | fromdateiso8601) - $created > 60) | .createdAt] | last) as $when |
  select($when != null) |
  "  #\(.number)  \(.title)  at \($when)\n    last comment: \(.comments.nodes[0].body // "none" | split("\n")[0])"'

printf '\nstalled:\n'
printf '%s' "$doc" | jq -r '
  [.data.openprs.nodes[].closingIssuesReferences.nodes[].number] as $with_pr |
  .data.claimed.nodes[] |
  select((.assignees.nodes | length) > 0) |
  select(.number as $n | $with_pr | index($n) | not) |
  ([.timelineItems.nodes[].createdAt] | last) as $claimed |
  select($claimed != null and (now - ($claimed | fromdateiso8601)) > 6 * 3600) |
  ([.comments.nodes[].body | capture("(?<t>(mcp:|thread:)[A-Za-z0-9:%.-]+)").t] | last // "no thread id in a comment") as $thread |
  "  #\(.number)  \(.title)  claimed \($claimed)  thread \($thread)"'

printf '\nnext up:\n'
bash "$frontier" | sed 's/^/  /' | tee "$tmp/frontier.txt"
printf '  lint failures: %s of %s ready-for-agent tickets\n' \
  "$(grep -c '  lint: ' "$tmp/frontier.txt" || true)" \
  "$(printf '%s' "$doc" | jq '.data.claimed.nodes | length')"

printf '\nguides: %s\n' "$(printf '%s' "$doc" | jq -r '[.data.decide.nodes[].number | "#\(.)"] | join(" ") | if . == "" then "none" else . end')"
