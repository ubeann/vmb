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
# Refused shapes, read over the whole command with its newlines folded:
#   - `sleep` anywhere in the command, by any path and with any duration;
#   - `gh pr checks … --watch`, `gh run watch`;
#   - a `while` or `until` loop with `gh pr`, `gh api` or `gh run` in its
#     condition or its body, or a `for` loop over a `seq` that calls them.
#     A `for` over a fixed list (`for n in 495 506; do gh pr view "$n"`) is a
#     batch, not a wait, and passes; a wait inside it is caught by the pause
#     rule above.
# The hook reads only the command line the agent typed, so a script file is
# outside it: a batch of `gh` writes in a loop (answering twenty review
# threads) goes in a file written with the Write tool and run by name, and a
# script under `scripts/` may pause inside itself. Prose inside the line
# counts too: a commit message or PR body that quotes one of these shapes is
# refused, so such text goes through the Write tool and a `-F` or
# `--body-file`.
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

# One line, as Bash reads it: a backslash-newline joins two lines into one
# word (so `sleep\` + newline + `2` is `sleep 2`), then every other newline is
# a separator, so a loop or a pipeline split across lines reads as one command.
joined=${cmd//\\$'\n'/}
flat=$(printf '%s' "$joined" | tr '\n' ' ')
reason=""
# shellcheck disable=SC2016 # a `$(` inside a pattern is text, not an expansion
if printf '%s' "$flat" | grep -Eq '(^|[;&|(`{]|[[:space:]])(/[^[:space:]]*/)?sleep([[:space:]]|$)'; then
  reason="sleep"
elif printf '%s' "$flat" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+checks[^;|]*--watch|gh[[:space:]]+run[[:space:]]+watch'; then
  reason="a gh watch"
elif printf '%s' "$flat" | grep -Eq '(^|[;&|(`{]|[[:space:]])(while|until)[[:space:]].*gh[[:space:]]+(pr|api|run)([[:space:]]|$)'; then
  reason="a shell loop over gh"
elif printf '%s' "$flat" | grep -Eq '(^|[;&|(`{]|[[:space:]])for[[:space:]].*[[:space:](`]seq[[:space:]].*gh[[:space:]]+(pr|api|run)([[:space:]]|$)'; then
  reason="a counted loop over gh"
fi
[ -n "$reason" ] || exit 0

cat >&2 <<EOF
Refused: this command waits by $reason. Let T3 do the waiting instead: for a PR, call watch_pull_request and end the turn (T3 wakes the thread on a check conclusion or a comment); for a background command or a subagent, end the turn and act on its notification; a red check is read with scripts/ci-failed.sh <pr>. See docs/agents/ticket-loop.md, Build.
EOF
exit 2
