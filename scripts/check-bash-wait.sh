#!/usr/bin/env bash
#
# Claude Code `PreToolUse` hook for the Bash tool (`.claude/settings.json`):
# refuse a command that waits by polling. Waiting is T3's job: a thread calls
# `watch_pull_request` and ends its turn, a background command or subagent
# wakes the thread when it finishes (`docs/agents/ticket-loop.md`, Build;
# `docs/agents/t3-code.md`, Gotchas). The harness itself blocks a command that
# starts with `sleep`; between 10 and 18 October 2026 six threads got round
# that with a `sleep` further along the line, an `until … gh pr checks` loop,
# `gh pr checks --watch` and `gh run watch`, one of them for 560 seconds.
#
# Refused shapes:
#   - `sleep <n>` anywhere in the command;
#   - `gh pr checks … --watch`, `gh run watch`;
#   - a `for`, `while` or `until` loop whose body calls `gh pr`, `gh api` or
#     `gh run`.
# A script under `scripts/` may still sleep inside itself; the hook reads only
# the command line the agent typed.
#
# The hook reads the tool call as JSON on stdin and exits 2 with the reason on
# stderr, which Claude Code shows the model instead of running the command.
#
# Usage:
#   scripts/check-bash-wait.sh                  hook mode: JSON on stdin
#   scripts/check-bash-wait.sh --command "<cmd>" test mode: judge one command
# Tests: `bash scripts/check-bash-wait.test.sh`.

set -euo pipefail

if [ "${1:-}" = "--command" ]; then
  cmd=${2-}
else
  cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null || true)
fi
[ -n "$cmd" ] || exit 0

reason=""
if printf '%s' "$cmd" | grep -Eq '(^|[;&|(`{]|[[:space:]])sleep[[:space:]]+[0-9]'; then
  reason="sleep"
elif printf '%s' "$cmd" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+checks[^;&|]*--watch|gh[[:space:]]+run[[:space:]]+watch'; then
  reason="a gh watch"
elif printf '%s' "$cmd" | grep -Eq '(^|[;&|(`{]|[[:space:]])(for|while|until)[[:space:]].*[[:space:]]do[[:space:]].*gh[[:space:]]+(pr|api|run)[[:space:]]'; then
  reason="a shell loop over gh"
fi
[ -n "$reason" ] || exit 0

cat >&2 <<EOF
Refused: this command waits by $reason. Let T3 do the waiting instead: for a PR, call watch_pull_request and end the turn (T3 wakes the thread on a check conclusion or a comment); for a background command or a subagent, end the turn and act on its notification; a red check is read with scripts/ci-failed.sh <pr>. See docs/agents/ticket-loop.md, Build.
EOF
exit 2
