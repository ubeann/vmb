#!/usr/bin/env bash
#
# Decide whether an agent may merge a PR without the owner. Merging to `master`
# deploys to production (`ci.yml`'s Release job). GitHub enforces the basics
# through the `master` ruleset (`scripts/master-ruleset.sh`, ADR-0054): a PR, a
# green `Verify`, and no force-push or deletion. It cannot judge the rest (the
# ticket's tier, its criteria, the door, the paths touched), so this script
# stays the only thing that decides what an agent may merge. The loop that runs
# it is `docs/agents/ticket-loop.md`.
#
# A PR passes only when all of these hold:
#   - it targets `master` and GitHub reports it MERGEABLE;
#   - every check finished green (success, skipped or neutral), and there is one;
#   - it closes at least one issue, all in this repository, and each is
#     `complexity:trivial` or `complexity:standard` without `review:human`;
#   - the PR has neither `review:human` nor `needs-decision`;
#   - its body has no unticked `- [ ]` box and exactly one `**Door:**` line,
#     which says two-way;
#   - it touches no one-way path: migrations, the Drizzle schema, `.github/`,
#     `fnox.toml` (secrets), or a `wrangler.toml` (deploy config);
#   - `Verify` has reported, and `CodeQL` has when the PR changes a file CodeQL
#     scans here (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, or a workflow or
#     action under `.github/`); the `master` ruleset requires only `Verify`;
#   - the on-request review round has happened (`docs/agents/model-routing.md`,
#     Review): on a `standard` or `complex` ticket, a trusted author asked
#     CodeRabbit (`@coderabbitai review`) and CodeRabbit submitted a review
#     after the latest ask; the same for Sourcery (`@sourcery-ai review`) when
#     the ticket is `complex` or the PR touches `apps/api/` or `packages/db/`;
#     a rate-limit reply from either is not a review;
#   - every review thread a reviewer bot opened is resolved or carries a reply
#     from a trusted author (`ubeann` or `vmb-agent`): each finding gets a fix
#     or one sentence, never silence. PRs #485 and #486 merged on 2026-10-18
#     minutes before Sourcery's findings landed, which is why the gate reads
#     the round instead of trusting the timing.
#
# Usage:
#   scripts/merge-gate.sh <pr-number>      fetch the PR with `gh` and judge it
#   scripts/merge-gate.sh --input <file>   judge a saved {pr, issues} document
#                                          (what the tests use)
# Prints PASS, or FAIL and one reason per line; exits 0 on PASS, 1 on FAIL.
# `scripts/merge.sh` runs this and merges on PASS; a build calls that, not
# `gh pr merge`. Tests: `bash scripts/merge-gate.test.sh`.

set -euo pipefail

usage() {
  echo "usage: merge-gate.sh <pr-number> | merge-gate.sh --input <file>" >&2
  exit 2
}

[ $# -ge 1 ] || usage

if [ "$1" = "--input" ]; then
  [ $# -eq 2 ] || usage
  doc=$(cat "$2")
else
  # `gh pr view` loads every page of `comments` and `reviews` before printing.
  pr=$(gh pr view "$1" --json \
    number,baseRefName,mergeable,labels,body,headRefOid,statusCheckRollup,closingIssuesReferences,comments,reviews)
  # `gh pr view --json files` stops at 100 files on older gh releases, which
  # would hide a one-way path in a big PR; the paginated REST list never does.
  files=$(gh api --paginate "repos/{owner}/{repo}/pulls/$1/files" --jq '.[].filename' |
    jq -R '{path: .}' | jq -s '.')
  repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
  # Review threads (a reviewer's inline finding and the replies under it) have
  # no `gh pr view` field, so GraphQL lists them, every page. A thread with
  # more than 100 replies is marked incomplete and the gate refuses to judge it.
  threads="[]"
  after=null
  while :; do
    # shellcheck disable=SC2016 # the $variables are GraphQL's, bound with -F
    page=$(gh api graphql -F owner="${repo%/*}" -F name="${repo#*/}" -F number="$1" -f query="
      query(\$owner: String!, \$name: String!, \$number: Int!) {
        repository(owner: \$owner, name: \$name) {
          pullRequest(number: \$number) {
            reviewThreads(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes { isResolved path
                comments(first: 100) {
                  pageInfo { hasNextPage }
                  nodes { author { login } createdAt } } } } } } }")
    threads=$(printf '%s' "$page" | jq --argjson so_far "$threads" '
      $so_far + [.data.repository.pullRequest.reviewThreads.nodes[]
        | {isResolved, path, complete: (.comments.pageInfo.hasNextPage | not),
           comments: [.comments.nodes[] | {author: .author.login, createdAt}]}]')
    if [ "$(printf '%s' "$page" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')" = true ]; then
      after=$(printf '%s' "$page" | jq '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
    else
      break
    fi
  done
  pr=$(printf '%s' "$pr" | jq --argjson files "$files" --argjson threads "$threads" \
    '. + {files: $files, reviewThreads: $threads}')
  issues="[]"
  # By URL, not number: a PR can close an issue in another repository.
  for url in $(printf '%s' "$pr" | jq -r '.closingIssuesReferences[].url'); do
    issues=$(printf '%s' "$issues" |
      jq --argjson issue "$(gh issue view "$url" --json number,url,labels)" '. + [$issue]')
  done
  doc=$(jq -n --arg repo "$repo" --argjson pr "$pr" --argjson issues "$issues" \
    '{repo: $repo, pr: $pr, issues: $issues}')
fi

reasons=$(printf '%s' "$doc" | jq -r '
  def names: [.labels[]?.name];
  def one_way:
    test("^migrations/") or test("^packages/db/src/schema/") or test("^\\.github/")
    or . == "fnox.toml" or test("(^|/)wrangler\\.toml$");
  def green:
    if .__typename == "StatusContext" then .state == "SUCCESS"
    else .status == "COMPLETED" and (.conclusion | IN("SUCCESS", "SKIPPED", "NEUTRAL"))
    end;
  # The REST API spells a bot `coderabbitai[bot]`; GraphQL and `gh pr view`
  # spell it `coderabbitai`. Compare the bare login.
  def login: (. // "") | sub("\\[bot\\]$"; "");
  def trusted: login | IN("ubeann", "vmb-agent");
  def codeql_path: test("\\.(ts|tsx|js|mjs|cjs)$") or test("^\\.github/(workflows|actions)/");
  def api_or_db: test("^apps/api/") or test("^packages/db/");

  .repo as $repo | .pr as $pr | .issues as $issues
  | [$pr.statusCheckRollup[] | (.name // .context)] as $checks
  | [$pr.files[].path] as $paths
  | ($pr.comments // []) as $comments
  | ($pr.reviews // []) as $reviews
  | ($pr.reviewThreads // []) as $threads
  # The round is owed on a standard or complex ticket; a trivial one skips it.
  | ([$issues[] | names[] | select(. == "complexity:standard" or . == "complexity:complex")] | length > 0) as $reviewed_tier
  | ([$issues[] | names[] | select(. == "complexity:complex")] | length > 0) as $complex
  | ($reviewed_tier and ($complex or any($paths[]; api_or_db))) as $sourcery_due
  # One entry per reviewer: its bot login, how it is asked, and the latest
  # ask by a trusted author. A reply from the bot counts only when it is a
  # submitted review dated after that ask and made on the current head of the
  # PR: a push after the review leaves code the reviewer never saw. A
  # rate-limit reply is named apart. (No apostrophes in this jq program: the
  # shell quotes it with single quotes.)
  | ($pr.headRefOid // null) as $head
  | [
      {name: "CodeRabbit", bot: "coderabbitai", ask: "@coderabbitai (full )?review", due: $reviewed_tier},
      {name: "Sourcery", bot: "sourcery-ai", ask: "@sourcery-ai review", due: $sourcery_due}
    ]
  | map(select(.due))
  | map(. as $r
      | ([$comments[] | select((.author.login | trusted) and (.body | test($r.ask)))
          | .createdAt] | max) as $asked
      | [$reviews[] | select((.author.login | login) == $r.bot and .submittedAt >= ($asked // ""))] as $since_ask
      | ([$since_ask[] | select($head == null or .commit.oid == $head) | .submittedAt] | max) as $reviewed
      | ([$since_ask[] | .commit.oid // ""] | last // "") as $stale_oid
      | ([$comments[] | select((.author.login | login) == $r.bot and .createdAt >= ($asked // "")
          and (.body | test("rate limit"; "i")))] | length > 0) as $limited
      | . + {asked: $asked, reviewed: $reviewed, stale: ($since_ask | length > 0), stale_oid: $stale_oid, limited: $limited})
    as $reviewers
  | [
      (if $pr.baseRefName != "master"
        then "Targets `\($pr.baseRefName)`, not `master`: a stacked PR merges by hand." else empty end),
      (if $pr.mergeable != "MERGEABLE"
        then "GitHub reports it \($pr.mergeable), not MERGEABLE." else empty end),
      (if ($pr.statusCheckRollup | length) == 0 then "No checks have reported yet." else empty end),
      ($pr.statusCheckRollup[] | select(green | not)
        | "Check `\(.name // .context)` is not green (\(.conclusion // .status // .state))."),
      (if ($issues | length) == 0 then "Closes no issue: add `Closes #<n>`." else empty end),
      ($issues[] | select((.url // "") | startswith("https://github.com/\($repo)/issues/") | not)
        | "#\(.number) is outside \($repo) (\(.url)): the owner merges cross-repo work."),
      ($issues[] | . as $i | names as $l
        | if ($l | index("complexity:trivial") or index("complexity:standard")) | not
            then "#\($i.number) is not complexity:trivial or complexity:standard." else empty end,
          if $l | index("review:human") then "#\($i.number) is labelled review:human." else empty end),
      ($pr | names[] | select(. == "review:human" or . == "needs-decision")
        | "The PR is labelled \(.)."),
      (if ($pr.body // "") | test("(?m)^\\s*[-*+]\\s+\\[ \\]") then "The body has unticked `- [ ]` items." else empty end),
      # Exactly one live Door line, and it says two-way: a struck-through,
      # quoted or superseded declaration does not count.
      ([($pr.body // "") | split("\n")[] | sub("\r$"; "") | select(test("^\\*\\*Door:\\*\\*"))] as $doors
        | if ($doors | length) != 1 or ($doors[0] | test("^\\*\\*Door:\\*\\*\\s*two-way\\s*$"; "i") | not)
          then "The body does not declare exactly one `**Door:** two-way` line." else empty end),
      ($pr.files[].path | select(one_way) | "Touches one-way path `\(.)`."),
      (if ($checks | length) > 0 and ($checks | index("Verify") | not)
        then "Check `Verify` has not reported." else empty end),
      (if any($paths[]; codeql_path) and ($checks | index("CodeQL") | not)
        then "Check `CodeQL` has not reported, and the PR changes code it scans." else empty end),
      ($reviewers[]
        | if .asked == null
            then "\(.name) has not been asked for a review: comment `\(.ask | sub("\\(full \\)\\?"; ""))`."
          elif .limited and .reviewed == null
            then "\(.name) answered the ask at \(.asked) with a rate limit: ask again after the time it names."
          elif .reviewed == null and .stale
            then "The last \(.name) review is of \(.stale_oid[0:7]), not the head \($head[0:7]): a push followed it, so ask again."
          elif .reviewed == null
            then "\(.name) has not reviewed since the ask at \(.asked)."
          else empty end),
      # A reviewer thread is answered when it is resolved or when a trusted
      # author wrote its last comment: a bot follow-up after the reply reopens
      # the question. A thread too long to have been fetched whole is not
      # judged, so it fails rather than passes.
      ($threads[]
        | select((.comments[0].author | login) | IN("coderabbitai", "sourcery-ai"))
        | select(.isResolved | not)
        | if .complete == false
            then "Review thread by \(.comments[0].author | login) on `\(.path)` has over 100 replies: not judged."
          elif (.comments | last | .author | trusted)
            then empty
          else "Review thread by \(.comments[0].author | login) on `\(.path)` has no reply after its last finding." end)
    ]
  | .[]
')

if [ -z "$reasons" ]; then
  echo PASS
else
  echo FAIL
  printf '%s\n' "$reasons" | sed 's/^/- /'
  exit 1
fi
