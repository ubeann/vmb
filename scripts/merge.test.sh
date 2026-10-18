#!/usr/bin/env bash
#
# Tests for `merge.sh`: the gate decides, the owner's recorded approval is the
# only way past a FAIL, and `--dry-run` runs no `gh` call. A stub stands in for
# `merge-gate.sh` through MERGE_GATE.
#
# Run from anywhere: `bash scripts/merge.test.sh`. CI runs it in the `Verify`
# job, and lefthook runs it on a commit that touches the script or this file.

set -euo pipefail

cd "$(dirname "$0")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cat >"$tmp/pass.sh" <<'EOF'
echo PASS
EOF
cat >"$tmp/fail.sh" <<'EOF'
echo FAIL
echo "- Touches one-way path \`.github/workflows/ci.yml\`."
exit 1
EOF

failures=0
checks=0

# check <description> <gate stub> <expected exit> <expected output substring> <args...>
check() {
  local description=$1 gate=$2 expected_exit=$3 expected_text=$4
  shift 4
  local output status=0
  checks=$((checks + 1))
  output=$(MERGE_GATE="$tmp/$gate" bash merge.sh "$@" 2>&1) || status=$?
  if [ "$status" -eq "$expected_exit" ] && [[ "$output" == *"$expected_text"* ]]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n' \
      "$description" "$status" "$expected_exit" "$output"
    failures=$((failures + 1))
  fi
}

check "a PASS marks the PR ready and squash-merges it" pass.sh 0 \
  "would run: gh pr merge 300 --squash --delete-branch" 300 --dry-run

check "a PASS marks ready before merging" pass.sh 0 \
  "would run: gh pr ready 300" 300 --dry-run

check "a PASS posts no approval comment" pass.sh 0 "" 300 --dry-run
output=$(MERGE_GATE="$tmp/pass.sh" bash merge.sh 300 --dry-run)
if [[ "$output" == *"gh pr comment"* ]]; then
  echo "FAIL a PASS posts no approval comment: a comment was posted"
  failures=$((failures + 1))
fi

check "a FAIL without approval merges nothing" fail.sh 1 \
  "Not merged: the gate refused" 300 --dry-run

check "a FAIL without approval prints the reasons" fail.sh 1 \
  "one-way path" 300 --dry-run

check "a FAIL with the owner's approval records it on the PR" fail.sh 0 \
  "would run: gh pr comment 300 --body Owner approved the merge past the gate: ubeann in the thread" \
  300 --dry-run --owner-approved "ubeann in the thread"

check "the approval comment quotes the gate's reasons" fail.sh 0 \
  "Touches one-way path" 300 --dry-run --owner-approved "ubeann in the thread"

check "a FAIL with the owner's approval then merges" fail.sh 0 \
  "would run: gh pr merge 300 --squash --delete-branch" 300 --dry-run --owner-approved "ubeann in the thread"

check "a PR number is required" pass.sh 2 "usage" abc --dry-run

check "an unknown flag is refused" pass.sh 2 "usage" 300 --force

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
