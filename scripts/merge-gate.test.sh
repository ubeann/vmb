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
    "body": "Closes #218\n\n## Acceptance criteria\n\n- [x] Footer renders\n\n## Merge Danger\n\n**Door:** two-way",
    "files": [{"path": "apps/web/src/lib/components/AppShell.svelte"}],
    "statusCheckRollup": [
      {"__typename": "CheckRun", "name": "Verify", "status": "COMPLETED", "conclusion": "SUCCESS"},
      {"__typename": "CheckRun", "name": "Real Postgres", "status": "COMPLETED", "conclusion": "SKIPPED"},
      {"__typename": "StatusContext", "context": "Socket", "state": "SUCCESS"}
    ],
    "closingIssuesReferences": [{"number": 218}]
  },
  "issues": [{"number": 218, "url": "https://github.com/ubeann/vmb/issues/218", "labels": [{"name": "ready-for-agent"}, {"name": "complexity:standard"}]}]
}'

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

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
