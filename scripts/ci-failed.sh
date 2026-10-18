#!/usr/bin/env bash
#
# Read a red CI run for a PR without downloading the run's logs by hand
# (`docs/agents/ticket-loop.md`, Build). A build that sees a failed check used
# to fetch whole job logs with `gh run view --log-failed` and poll the check
# status in a loop; the log endpoint hung for minutes more than once, and a
# full `Verify` log is 100 KB for a one-line failure. This prints what the
# agent needs, smallest first: the failed check names, the failing step of
# each failed job, the check-run annotations (which carry the Knip, eslint and
# test reporter messages), and the tail of the failing step's log, with every
# `gh` call under a timeout.
#
# Usage:
#   scripts/ci-failed.sh <pr-number> [--tail N]   the PR's head commit's checks
#   scripts/ci-failed.sh --job <job-id> [--tail N] one Actions job
#   scripts/ci-failed.sh --input <file>            report a saved {head, checks,
#                                                  jobs} document, no network
#                                                  (what the tests use)
#   scripts/ci-failed.sh --filter <step> < job.log the lines of one step from a
#                                                  `gh run view --job <id> --log`
#                                                  dump, prefixes stripped
#
# Output:
#   head: <sha>
#   checks: <n> failed, <n> pending, <n> green
#     failed: <check name> (<url>)
#   job: <name> (<url>)
#     failed step: <step>
#     annotation: <path>:<line> <title>: <message>
#     log: <step>, last N lines
#       <log lines>
#
# Exits 1 when a check failed, 3 when none failed but some are still running
# (wait through `watch_pull_request`, not a loop), 0 when every check is green.
# Each `gh` call runs under `timeout` (CI_FAILED_TIMEOUT, default 60 s), so a
# hung log download fails the one section instead of the agent's turn.
# Tests: `bash scripts/ci-failed.test.sh`.

set -euo pipefail

usage() {
  echo "usage: ci-failed.sh <pr-number> [--tail N] | --job <job-id> [--tail N] | --input <file> | --filter <step>" >&2
  exit 2
}

tail_n=60
pr=""
job=""
input=""
filter=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tail)
      tail_n=${2:?--tail needs a number}
      shift 2
      ;;
    --job)
      job=${2:?--job needs a job id}
      shift 2
      ;;
    --input)
      input=${2:?--input needs a file}
      shift 2
      ;;
    --filter)
      filter=${2:?--filter needs a step name}
      shift 2
      ;;
    -*)
      usage
      ;;
    *)
      [ -z "$pr" ] || usage
      pr=$1
      shift
      ;;
  esac
done

gh_t() {
  timeout "${CI_FAILED_TIMEOUT:-60}" gh "$@"
}

# `gh run view --job <id> --log` prints `<job>\t<step>\t<timestamp> <line>`.
# Keep the lines of one step and strip the three prefixes. The first line of a
# step carries a byte-order mark before its timestamp, so the timestamp is
# matched as "everything up to the first space ending in Z".
filter_log() {
  awk -F'\t' -v step="$1" '$2 == step { line = $3; sub(/^[^ ]*Z /, "", line); print line }'
}

if [ -n "$filter" ]; then
  filter_log "$filter"
  exit 0
fi

# One Actions job: its failed steps and annotations. The job id is also the
# check-run id, which is where the annotations live.
job_doc() {
  local id=$1 steps annotations
  steps=$(gh_t api "repos/{owner}/{repo}/actions/jobs/$id" \
    --jq '{id, name, url: .html_url, failed_steps: [.steps[] | select(.conclusion == "failure") | .name]}')
  annotations=$(gh_t api --paginate "repos/{owner}/{repo}/check-runs/$id/annotations" \
    --jq '[.[] | {path, line: .start_line, level: .annotation_level, title, message}]' | jq -s 'add // []')
  printf '%s' "$steps" | jq --argjson annotations "$annotations" '. + {annotations: $annotations}'
}

if [ -n "$input" ]; then
  [ -z "$pr" ] && [ -z "$job" ] || usage
  doc=$(cat "$input")
elif [ -n "$job" ]; then
  [ -z "$pr" ] || usage
  doc=$(jq -n --argjson job "$(job_doc "$job")" '{head: null, checks: [], jobs: [$job]}')
else
  [ -n "$pr" ] || usage
  view=$(gh_t pr view "$pr" --json headRefOid,statusCheckRollup)
  # A CheckRun has a conclusion; a StatusContext (an external service) has a
  # state. Both are folded into one `conclusion` field.
  checks=$(printf '%s' "$view" | jq '[.statusCheckRollup[] | {
    name: (.name // .context),
    status: (.status // "COMPLETED"),
    conclusion: ((.conclusion // .state // "") | ascii_upcase),
    url: (.detailsUrl // .targetUrl // "")
  }]')
  jobs="[]"
  for id in $(printf '%s' "$checks" | jq -r '.[] | select(.conclusion == "FAILURE") | .url | capture("/job/(?<id>[0-9]+)") | .id'); do
    jobs=$(printf '%s' "$jobs" | jq --argjson job "$(job_doc "$id")" '. + [$job]')
  done
  doc=$(printf '%s' "$view" | jq --argjson checks "$checks" --argjson jobs "$jobs" \
    '{head: .headRefOid, checks: $checks, jobs: $jobs}')
fi

printf '%s' "$doc" | jq -r '
  def failed: [.checks[] | select(.conclusion == "FAILURE" or .conclusion == "ERROR" or .conclusion == "TIMED_OUT" or .conclusion == "CANCELLED")];
  def pending: [.checks[] | select(.status != "COMPLETED")];
  def green: [.checks[] | select(.status == "COMPLETED") | select(.conclusion == "SUCCESS" or .conclusion == "SKIPPED" or .conclusion == "NEUTRAL")];
  (if .head then "head: \(.head)" else empty end),
  "checks: \(failed | length) failed, \(pending | length) pending, \(green | length) green",
  (failed[] | "  failed: \(.name) (\(.url))"),
  (pending[] | "  pending: \(.name)"),
  (.jobs[] |
    "job: \(.name) (\(.url))",
    (.failed_steps[] | "  failed step: \(.)"),
    (.annotations[] | select(.level != "notice") |
      "  annotation: \(.path):\(.line) \(if .title != "" then .title + ": " else "" end)\(.message | gsub("\n"; " "))"))
'

# Logs are the expensive part, so they come last and only online: the tail of
# each failing step, long enough for a test reporter's failure block.
if [ -z "$input" ]; then
  for id in $(printf '%s' "$doc" | jq -r '.jobs[].id'); do
    log=$(gh_t run view --job "$id" --log 2>/dev/null) || {
      echo "  log: download failed or timed out for job $id; open the url above"
      continue
    }
    for step in $(printf '%s' "$doc" | jq -r --argjson id "$id" '.jobs[] | select(.id == $id) | .failed_steps[] | @sh'); do
      step=$(eval "printf '%s' $step")
      echo "  log: $step, last $tail_n lines"
      printf '%s\n' "$log" | filter_log "$step" | tail -n "$tail_n" | sed 's/^/    /'
    done
  done
fi

failed=$(printf '%s' "$doc" | jq '[.checks[] | select(.conclusion == "FAILURE" or .conclusion == "ERROR" or .conclusion == "TIMED_OUT" or .conclusion == "CANCELLED")] | length')
pending=$(printf '%s' "$doc" | jq '[.checks[] | select(.status != "COMPLETED")] | length')
if [ "$failed" -gt 0 ] || [ "$(printf '%s' "$doc" | jq '.jobs | length')" -gt 0 ]; then
  exit 1
elif [ "$pending" -gt 0 ]; then
  exit 3
fi
