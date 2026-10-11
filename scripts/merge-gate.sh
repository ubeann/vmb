#!/usr/bin/env bash
#
# Decide whether an agent may merge a PR without the owner. Merging to `master`
# deploys to production (`ci.yml`'s Release job). GitHub enforces the basics
# through the `master` ruleset (`scripts/master-ruleset.sh`, ADR-0054): a PR, a
# green `Verify` and `Real Postgres`, and no force-push or deletion. It cannot
# judge the rest (the ticket's tier, its criteria, the door, the paths touched),
# so this script stays the only thing that decides what an agent may merge. The
# loop that runs it is `docs/agents/ticket-loop.md`.
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
#     `fnox.toml` (secrets), or a `wrangler.toml` (deploy config).
#
# Usage:
#   scripts/merge-gate.sh <pr-number>      fetch the PR with `gh` and judge it
#   scripts/merge-gate.sh --input <file>   judge a saved {pr, issues} document
#                                          (what the tests use)
# Prints PASS, or FAIL and one reason per line; exits 0 on PASS, 1 on FAIL.
# Tests: `bash scripts/merge-gate.test.sh`.

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
  pr=$(gh pr view "$1" --json \
    number,baseRefName,mergeable,labels,body,statusCheckRollup,closingIssuesReferences)
  # `gh pr view --json files` stops at 100 files on older gh releases, which
  # would hide a one-way path in a big PR; the paginated REST list never does.
  files=$(gh api --paginate "repos/{owner}/{repo}/pulls/$1/files" --jq '.[].filename' |
    jq -R '{path: .}' | jq -s '.')
  pr=$(printf '%s' "$pr" | jq --argjson files "$files" '. + {files: $files}')
  repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
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

  .repo as $repo | .pr as $pr | .issues as $issues
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
      ($pr.files[].path | select(one_way) | "Touches one-way path `\(.)`.")
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
