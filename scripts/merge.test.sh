#!/usr/bin/env bash
#
# Tests for `merge.sh`: the gate decides, the owner's recorded approval is the
# only way past a FAIL and never past an error, the pace holds every merge
# past the gate and labels the PR when it says wait, the merge is pinned to
# the head the gate judged, and `--dry-run` runs no write. Stubs stand in for
# `merge-gate.sh` through MERGE_GATE and for `pace.sh` through MERGE_PACE
# (OK unless a check names another), and a stub `gh` on PATH records every
# call it receives, in order.
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
cat >"$tmp/error.sh" <<'EOF'
echo "gh: Could not resolve to a PullRequest" >&2
exit 1
EOF
cat >"$tmp/pace-ok.sh" <<'EOF'
echo OK
echo "Merged today by vmb-agent: 0 of 12; last merge none."
EOF
cat >"$tmp/pace-wait.sh" <<'EOF'
echo WAIT
echo "- gap: the last merge was at 11:50 WIB, under 15 minutes ago; merge after 12:05 WIB."
exit 1
EOF

# The stub gh: logs its arguments, answers the head lookup, succeeds otherwise.
mkdir -p "$tmp/bin"
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "gh $*" >>"$GH_LOG"
if [ "$1 $2" = "pr view" ]; then echo "abc1234ffffffffffffffffffffffffffffffffff"; fi
EOF
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"

failures=0
checks=0

# check <description> <gate stub> <expected exit> <expected output substring> <expected gh log, newline-separated or ""> <args...>
check() {
  local description=$1 gate=$2 expected_exit=$3 expected_text=$4 expected_log=$5
  shift 5
  local output log status=0
  checks=$((checks + 1))
  : >"$tmp/gh.log"
  output=$(GH_LOG="$tmp/gh.log" MERGE_GATE="$tmp/$gate" MERGE_PACE="$tmp/${PACE_STUB:-pace-ok.sh}" \
    bash merge.sh "$@" 2>&1) || status=$?
  log=$(cat "$tmp/gh.log")
  if [ "$status" -eq "$expected_exit" ] && [[ "$output" == *"$expected_text"* ]] && [ "$log" = "$expected_log" ]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       exit: %s (expected %s)\n       output: %s\n       gh log: %s\n       expected log: %s\n' \
      "$description" "$status" "$expected_exit" "$output" "$log" "$expected_log"
    failures=$((failures + 1))
  fi
}

head=abc1234ffffffffffffffffffffffffffffffffff
view="gh pr view 300 --json headRefOid --jq .headRefOid"
ready="gh pr ready 300"
merge="gh pr merge 300 --squash --delete-branch --match-head-commit $head"

check "a PASS reads the head, marks ready, then merges pinned to that head" pass.sh 0 \
  "Merged #300 at head $head" \
  "$(printf '%s\n%s\n%s' "$view" "$ready" "$merge")" 300

check "a FAIL without approval stops after the head lookup" fail.sh 1 \
  "Not merged: the gate refused" \
  "$view" 300

check "a FAIL without approval prints the reasons" fail.sh 1 \
  "one-way path" \
  "$view" 300

check "a FAIL with the owner's approval comments, then readies, then merges" fail.sh 0 \
  "Merged #300" \
  "$(printf '%s\n%s\n%s\n%s' "$view" "gh pr comment 300 --body Owner approved the merge past the gate: ubeann in the thread

The gate said at the time, on head $head:

\`\`\`
FAIL
- Touches one-way path \`.github/workflows/ci.yml\`.
\`\`\`" "$ready" "$merge")" \
  300 --owner-approved "ubeann in the thread"

check "a gate that reached no verdict is never overridden" error.sh 1 \
  "reached no verdict" \
  "$view" 300 --owner-approved "ubeann in the thread"

PACE_STUB=pace-wait.sh check "a pace wait labels the PR and merges nothing" pass.sh 3 \
  "Not merged: the gate passed and the pace says wait" \
  "$(printf '%s\n%s' "$view" "gh pr edit 300 --add-label merge-paced")" 300

PACE_STUB=pace-wait.sh check "a pace wait posts no approval comment, so a rerun posts one" fail.sh 3 \
  "under 15 minutes ago" \
  "$(printf '%s\n%s' "$view" "gh pr edit 300 --add-label merge-paced")" \
  300 --owner-approved "ubeann in the thread"

PACE_STUB=error.sh check "a pace with no verdict merges nothing" pass.sh 1 \
  "the pace check reached no verdict" \
  "$view" 300

PACE_STUB=pace-wait.sh check "a FAIL without approval never reaches the pace" fail.sh 1 \
  "Not merged: the gate refused" \
  "$view" 300

check "an approval on a PASS posts no comment" pass.sh 0 \
  "Merged #300" \
  "$(printf '%s\n%s\n%s' "$view" "$ready" "$merge")" 300 --owner-approved "ubeann in the thread"

PACE_STUB=pace-wait.sh check "a dry run prints the label instead of adding it" pass.sh 3 \
  "would run: gh pr edit 300 --add-label merge-paced" \
  "$view" 300 --dry-run

check "a dry run runs the reads and prints the writes" pass.sh 0 \
  "would run: $merge" \
  "$view" 300 --dry-run

check "a dry run does not claim a merge" pass.sh 0 \
  "Dry run: #300 would merge at head $head. Nothing was changed." \
  "$view" 300 --dry-run

check "a dry run prints the approval comment instead of posting it" fail.sh 0 \
  "would run: gh pr comment 300" \
  "$view" 300 --dry-run --owner-approved "ubeann in the thread"

check "an approval with no text is refused" pass.sh 2 "usage" "" 300 --owner-approved ""

check "an approval followed by a flag is refused" pass.sh 2 "usage" "" 300 --owner-approved --dry-run

check "a PR number is required" pass.sh 2 "usage" "" abc --dry-run

check "an unknown flag is refused" pass.sh 2 "usage" "" 300 --force

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
