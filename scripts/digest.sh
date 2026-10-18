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
#             than 2 hours ago, with the thread id from the claim comment (four
#             of five builds on 2026-10-18 stopped before opening their PR)
#   review round: open PRs on a standard or complex ticket, checks green, where
#             a reviewer the gate requires (merge-gate.sh) has not been asked or
#             has not answered: the build stopped before its round
#   next up:  frontier.sh's output, then how many ready-for-agent tickets fail
#             ticket-lint
#   guides:   the PR numbers under decide, for write_pull_request_guides
#
# The GitHub call runs under `timeout` (DIGEST_TIMEOUT, default 60 s), like
# frontier.sh's: a hung call must not spend the digest's turn.

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
# GNU `timeout` is coreutils; macOS ships none, and Homebrew installs it as
# `timeout` or `gtimeout`. Without either the call runs unbounded, which still
# beats a report that never prints.
with_timeout() {
  local secs=$1
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$secs" "$@"
  else
    "$@"
  fi
}

doc=$(with_timeout "${DIGEST_TIMEOUT:-60}" gh api graphql -f query="{
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
      number title isDraft headRefOid
      author { login }
      closingIssuesReferences(first: 5) { nodes { number labels(first: 20) { nodes { name } } } }
      files(first: 100) { nodes { path } }
      comments(last: 100) { pageInfo { hasPreviousPage } nodes { author { login } body createdAt } }
      reviews(last: 100) { pageInfo { hasPreviousPage } nodes { author { login } submittedAt commit { oid } } }
      reviewThreads(first: 50) { pageInfo { hasNextPage }
        nodes { isResolved comments(first: 10) { pageInfo { hasNextPage } nodes { author { login } } } } }
      commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } }
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
  select($claimed != null and (now - ($claimed | fromdateiso8601)) > 2 * 3600) |
  ([.comments.nodes[].body | capture("(?<t>(mcp:|thread:)[A-Za-z0-9:%.-]+)").t] | last // "no thread id in a comment") as $thread |
  "  #\(.number)  \(.title)  claimed \($claimed)  thread \($thread)"'

# The same reviewer rules as merge-gate.sh: CodeRabbit on every standard or
# complex ticket, Sourcery too when the ticket is complex or the PR touches
# apps/api or packages/db; a review counts on the current head only; a
# reviewer thread is answered when resolved or when a trusted author has the
# last word. A PR is listed only when something is missing. The last 100
# comments and reviews, 50 threads and 10 replies a thread are read (GitHub
# caps one query at 500,000 nodes); anything past that is reported as unread,
# not guessed at, and the gate reads every page before a merge.
printf '\nreview round:\n'
printf '%s' "$doc" | jq -r '
  def login: (. // "") | sub("\\[bot\\]$"; "");
  def trusted: login | IN("ubeann", "vmb-agent");
  .data.openprs.nodes[] |
  select((.author.login | login) != "dependabot") |
  select(.commits.nodes[0].commit.statusCheckRollup.state == "SUCCESS") |
  ([.closingIssuesReferences.nodes[].labels.nodes[].name]) as $labels |
  select(($labels | index("complexity:standard")) != null or ($labels | index("complexity:complex")) != null) |
  ([.files.nodes[].path] | any(test("^apps/api/") or test("^packages/db/"))) as $apidb |
  . as $pr |
  ($pr.headRefOid) as $head |
  ([ {name: "CodeRabbit", bot: "coderabbitai", ask: "@coderabbitai (full )?review", due: true},
     {name: "Sourcery", bot: "sourcery-ai", ask: "@sourcery-ai review",
      due: ((($labels | index("complexity:complex")) != null) or $apidb)} ] |
   map(select(.due)) |
   map(. as $r |
     ([$pr.comments.nodes[] | select((.author.login | trusted) and (.body | test($r.ask))) | .createdAt] | max) as $asked |
     [$pr.reviews.nodes[] | select((.author.login | login) == $r.bot and .submittedAt >= ($asked // ""))] as $since |
     (any($since[]; .commit.oid == $head)) as $answered |
     (any($pr.comments.nodes[]; (.author.login | login) == $r.bot and .createdAt >= ($asked // "") and (.body | test("rate limit"; "i")))) as $limited |
     "\($r.name): \(
       if $asked == null then "not asked"
       elif $answered then "answered"
       elif $limited then "rate-limited, ask again later"
       elif ($since | length) > 0 then "reviewed an older head, ask again"
       else "asked \($asked[11:16])Z, no review yet" end)")) as $statuses |
  ([$pr.reviewThreads.nodes[]
    | select((.comments.nodes[0].author.login | login) | IN("coderabbitai", "sourcery-ai"))
    | select((.isResolved | not) and ((.comments.nodes | last | .author.login | trusted) | not))] | length) as $open |
  ($pr.comments.pageInfo.hasPreviousPage or $pr.reviews.pageInfo.hasPreviousPage or $pr.reviewThreads.pageInfo.hasNextPage
    or any($pr.reviewThreads.nodes[]; .comments.pageInfo.hasNextPage)) as $truncated |
  ($statuses + (if $open > 0 then ["\($open) reviewer thread(s) unanswered"] else [] end)
             + (if $truncated then ["over 100 comments, reviews or threads: read the PR"] else [] end)) as $parts |
  select(any($parts[]; endswith(": answered") | not)) |
  "  #\($pr.number)  \($pr.title)  \($parts | join("  "))"'

printf '\nnext up:\n'
bash "$frontier" | sed 's/^/  /' | tee "$tmp/frontier.txt"
printf '  lint failures: %s of %s ready-for-agent tickets\n' \
  "$(grep -c '  lint: ' "$tmp/frontier.txt" || true)" \
  "$(printf '%s' "$doc" | jq '.data.claimed.nodes | length')"

printf '\nguides: %s\n' "$(printf '%s' "$doc" | jq -r '[.data.decide.nodes[].number | "#\(.)"] | join(" ") | if . == "" then "none" else . end')"
