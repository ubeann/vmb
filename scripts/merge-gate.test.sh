#!/usr/bin/env bash
#
# Tests for `merge-gate.sh`, the check an agent runs before merging a PR
# without the owner. Each case starts from a PR that passes and breaks one rule.
#
# Run from anywhere: `bash scripts/merge-gate.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the script or
# this file.

set -euo pipefail

cd "$(dirname "$0")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

failures=0
checks=0

passing='{
  "repo": "ubeann/vmb",
  "pr": {
    "number": 300, "baseRefName": "master", "mergeable": "MERGEABLE", "labels": [],
    "headRefOid": "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "body": "Closes #218\n\n## Acceptance criteria\n\n- [x] Footer renders\n\n## Merge Danger\n\n**Door:** two-way",
    "files": [{"path": "apps/web/src/lib/components/AppShell.svelte"}],
    "statusCheckRollup": [
      {"__typename": "CheckRun", "name": "Verify", "status": "COMPLETED", "conclusion": "SUCCESS"},
      {"__typename": "CheckRun", "name": "Release", "status": "COMPLETED", "conclusion": "SKIPPED"},
      {"__typename": "StatusContext", "context": "Socket", "state": "SUCCESS"}
    ],
    "closingIssuesReferences": [{"number": 218}],
    "comments": [
      {"author": {"login": "vmb-agent"}, "createdAt": "2026-10-18T10:00:00Z", "body": "@coderabbitai review"}
    ],
    "reviews": [
      {"author": {"login": "coderabbitai"}, "submittedAt": "2026-10-18T10:05:00Z", "state": "COMMENTED", "body": "Actionable comments posted: 0", "commit": {"oid": "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}
    ],
    "reviewThreads": []
  },
  "issues": [{"number": 218, "url": "https://github.com/ubeann/vmb/issues/218", "labels": [{"name": "ready-for-agent"}, {"name": "complexity:standard"}]}]
}'

sourcery_round='.pr.comments += [{"author": {"login": "vmb-agent"}, "createdAt": "2026-10-18T10:00:00Z", "body": "@sourcery-ai review"}]
  | .pr.reviews += [{"author": {"login": "sourcery-ai"}, "submittedAt": "2026-10-18T10:04:00Z", "state": "COMMENTED", "body": "Hey - I have reviewed your changes and they look great!", "commit": {"oid": "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}]'

bot_thread='{"isResolved": false, "path": "apps/web/src/lib/components/AppShell.svelte",
  "comments": [{"author": "sourcery-ai", "createdAt": "2026-10-18T10:04:00Z"}]}'

# check <description> <expected exit> <expected output substring|""> <jq edit>
check() {
  local description=$1 expected_exit=$2 expected_text=$3 edit=$4
  local output status=0

  checks=$((checks + 1))
  printf '%s' "$passing" | jq "$edit" >"$tmp/doc.json"
  output=$(bash merge-gate.sh --input "$tmp/doc.json" 2>&1) || status=$?
  if [ "$status" -eq "$expected_exit" ] && { [ -z "$expected_text" ] || [[ "$output" == *"$expected_text"* ]]; }; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n' \
      "$description" "$status" "$expected_exit" "$output"
    failures=$((failures + 1))
  fi
}

check "a clean standard PR passes" 0 "PASS" '.'

check "a trivial ticket passes" 0 "PASS" \
  '.issues[0].labels = [{"name": "complexity:trivial"}]'

check "a stacked PR fails" 1 "not \`master\`" '.pr.baseRefName = "feature/db/rbac"'

check "a conflicting PR fails" 1 "CONFLICTING" '.pr.mergeable = "CONFLICTING"'

check "no checks yet fails" 1 "No checks have reported" '.pr.statusCheckRollup = []'

check "a running check fails" 1 "Check \`Verify\` is not green" \
  '.pr.statusCheckRollup[0] |= (.status = "IN_PROGRESS" | .conclusion = null)'

check "a failed status context fails" 1 "Check \`Socket\` is not green" \
  '.pr.statusCheckRollup[2].state = "FAILURE"'

check "a PR closing nothing fails" 1 "Closes no issue" \
  '.pr.closingIssuesReferences = [] | .issues = []'

check "a complex ticket fails" 1 "#218 is not complexity:trivial or complexity:standard" \
  '.issues[0].labels = [{"name": "complexity:complex"}]'

check "a ticket without complexity fails" 1 "#218 is not complexity:trivial" \
  '.issues[0].labels = [{"name": "ready-for-agent"}]'

check "a review:human ticket fails" 1 "#218 is labelled review:human" \
  '.issues[0].labels += [{"name": "review:human"}]'

check "an issue in another repository fails" 1 "#218 is outside ubeann/vmb" \
  '.issues[0].url = "https://github.com/ubeann/vmb-warehouse/issues/218"'

check "a + task marker counts as unticked" 1 "unticked" \
  '.pr.body += "\n+ [ ] Screenshots on the preview"'

check "a needs-decision PR fails" 1 "The PR is labelled needs-decision" \
  '.pr.labels = [{"name": "needs-decision"}]'

check "an unticked criterion fails" 1 "unticked" \
  '.pr.body += "\n- [ ] Screenshots on the preview"'

check "a one-way door fails" 1 "exactly one \`**Door:** two-way\` line" \
  '.pr.body |= sub("two-way"; "one-way")'

check "a struck-through door fails" 1 "exactly one \`**Door:** two-way\` line" \
  '.pr.body |= sub("\\*\\*Door:\\*\\* two-way"; "~~**Door:** two-way~~")'

check "a quoted door fails" 1 "exactly one \`**Door:** two-way\` line" \
  '.pr.body |= sub("\\*\\*Door:\\*\\* two-way"; "> **Door:** two-way")'

check "a door with trailing words fails" 1 "exactly one \`**Door:** two-way\` line" \
  '.pr.body |= sub("two-way"; "two-way-ish")'

check "a one-way line beside an old two-way line fails" 1 "exactly one \`**Door:** two-way\` line" \
  '.pr.body += "\n**Door:** one-way"'

check "a migration fails" 1 "one-way path \`migrations/0032_x.sql\`" \
  '.pr.files += [{"path": "migrations/0032_x.sql"}]'

check "the Drizzle schema fails" 1 "one-way path \`packages/db/src/schema/master.ts\`" \
  '.pr.files += [{"path": "packages/db/src/schema/master.ts"}]'

check "a workflow change fails" 1 "one-way path \`.github/workflows/ci.yml\`" \
  '.pr.files += [{"path": ".github/workflows/ci.yml"}]'

check "deploy config fails" 1 "one-way path \`apps/api/wrangler.toml\`" \
  '.pr.files += [{"path": "apps/api/wrangler.toml"}]'

check "secrets config fails" 1 "one-way path \`fnox.toml\`" \
  '.pr.files += [{"path": "fnox.toml"}]'

check "every reason is listed, not just the first" 1 "Closes no issue" \
  '.pr.mergeable = "CONFLICTING" | .pr.closingIssuesReferences = [] | .issues = []'

# The checks that must have reported, not merely be green when present.
check "a PR with checks but no Verify fails" 1 "Check \`Verify\` has not reported" \
  '.pr.statusCheckRollup[0].name = "Build"'

check "a .ts change without a CodeQL check fails" 1 "Check \`CodeQL\` has not reported" \
  '.pr.files += [{"path": "apps/api/src/auth.ts"}] | .' \

check "a .ts change with CodeQL reported passes" 0 "PASS" \
  '.pr.files += [{"path": "packages/types/src/roles.ts"}]
   | .pr.statusCheckRollup += [{"__typename": "CheckRun", "name": "CodeQL", "status": "COMPLETED", "conclusion": "SUCCESS"}]'

check "a Svelte-only change needs no CodeQL check" 0 "PASS" \
  '.pr.files = [{"path": "apps/web/src/routes/+page.svelte"}]'

# The on-request review round (model-routing.md, Review).
check "a trivial ticket skips the review round" 0 "PASS" \
  '.issues[0].labels = [{"name": "complexity:trivial"}] | .pr.comments = [] | .pr.reviews = []'

check "a standard PR nobody asked CodeRabbit about fails" 1 "CodeRabbit has not been asked for a review: comment \`@coderabbitai review\`" \
  '.pr.comments = []'

check "an ask by an untrusted author does not count" 1 "CodeRabbit has not been asked" \
  '.pr.comments[0].author.login = "someone-else"'

check "a review older than the latest ask fails" 1 "CodeRabbit has not reviewed since the ask at 2026-10-18T11:00:00Z" \
  '.pr.comments += [{"author": {"login": "vmb-agent"}, "createdAt": "2026-10-18T11:00:00Z", "body": "@coderabbitai review"}]'

check "a REST-spelled bot login still counts as the review" 0 "PASS" \
  '.pr.reviews[0].author.login = "coderabbitai[bot]"'

check "a rate-limit reply is not a review" 1 "CodeRabbit answered the ask at 2026-10-18T10:00:00Z with a rate limit" \
  '.pr.reviews = []
   | .pr.comments += [{"author": {"login": "coderabbitai"}, "createdAt": "2026-10-18T10:01:00Z", "body": "Rate limit exceeded. Please try again in 23 minutes."}]'

check "an API change also needs Sourcery" 1 "Sourcery has not been asked for a review: comment \`@sourcery-ai review\`" \
  '.pr.files += [{"path": "apps/api/src/routes/master/users.ts"}]
   | .pr.statusCheckRollup += [{"__typename": "CheckRun", "name": "CodeQL", "status": "COMPLETED", "conclusion": "SUCCESS"}]'

check "a db change with both rounds done passes" 0 "PASS" \
  ".pr.files += [{\"path\": \"packages/db/src/master/users.ts\"}]
   | .pr.statusCheckRollup += [{\"__typename\": \"CheckRun\", \"name\": \"CodeQL\", \"status\": \"COMPLETED\", \"conclusion\": \"SUCCESS\"}]
   | $sourcery_round"

check "a web-only standard PR needs no Sourcery" 0 "PASS" \
  '.pr.files = [{"path": "apps/web/src/lib/components/AppShell.svelte"}]'

# Every finding answered: a bot thread is resolved or carries a trusted reply.
check "an unanswered bot thread fails" 1 "Review thread by sourcery-ai on \`apps/web/src/lib/components/AppShell.svelte\` has no reply after its last finding" \
  ".pr.reviewThreads = [$bot_thread]"

check "a resolved bot thread passes" 0 "PASS" \
  ".pr.reviewThreads = [$bot_thread | .isResolved = true]"

check "a bot thread answered by vmb-agent passes" 0 "PASS" \
  ".pr.reviewThreads = [$bot_thread | .comments += [{\"author\": \"vmb-agent\", \"createdAt\": \"2026-10-18T10:30:00Z\"}]]"

check "a thread opened by a stranger is not the round's" 0 "PASS" \
  ".pr.reviewThreads = [$bot_thread | .comments[0].author = \"someone-else\"]"

check "a bot follow-up after the reply reopens the thread" 1 "has no reply after its last finding" \
  ".pr.reviewThreads = [$bot_thread | .comments += [{\"author\": \"vmb-agent\", \"createdAt\": \"2026-10-18T10:30:00Z\"}, {\"author\": \"sourcery-ai\", \"createdAt\": \"2026-10-18T10:40:00Z\"}]]"

check "a thread too long to fetch whole is not judged" 1 "has over 100 replies: not judged" \
  ".pr.reviewThreads = [$bot_thread | .complete = false]"

# A review counts only for the head it was made on.
check "a review of an older head fails until the reviewer is asked again" 1 "The last CodeRabbit review is of 1111111, not the head 2222222: a push followed it" \
  '.pr.headRefOid = "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"'

check "a second review on the new head passes" 0 "PASS" \
  '.pr.headRefOid = "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
   | .pr.reviews += [{"author": {"login": "coderabbitai"}, "submittedAt": "2026-10-18T10:20:00Z", "state": "COMMENTED", "body": "Actionable comments posted: 0", "commit": {"oid": "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}]'

check "a document without a head judges reviews by time alone" 0 "PASS" \
  'del(.pr.headRefOid) | del(.pr.reviews[0].commit)'

check "an old document without the review fields still judges the rest" 1 "CodeRabbit has not been asked" \
  'del(.pr.comments, .pr.reviews, .pr.reviewThreads)'

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
