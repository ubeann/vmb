#!/usr/bin/env bash
#
# The one definition of a "code-relevant change" (issue #83).
#
# A "code-relevant change" is a path a build or deploy actually depends on. Two
# gates consume this definition, so neither can drift from the other:
#
#   - `ci.yml`'s `Detect code-relevant changes` step gates the `Release` deploy
#     on a push to `master` (issue #63). It uses the canonical list only: a
#     workflow edit cannot change the deployed artifact, so it must not force a
#     deploy.
#   - `preview.yml`'s `Detect code-relevant changes` step, the first step of
#     its `preview` job, gates the preview on a pull request. It uses the
#     canonical list plus `.github/workflows/**`: a workflow edit still has to
#     be exercised by that PR's own preview run before it lands (ADR-0023).
#
# `preview.yml` used to hold the canonical list in its `on.paths` trigger, with
# `ci.yml` a hand-kept copy (issue #70). A workflow's `on.paths` cannot reference
# a shared value, so the two could drift; the only way to make one source back
# both is to give up the trigger filter and detect the change inside the run —
# which is what `preview.yml` now does (first as a job of its own, since #382 as
# the first step of the `preview` job).
#
# `.mise.toml` stays canonical despite dev-only pins (e.g. `lefthook`) that
# never change a build: the same file controls build-affecting pins (`node`,
# `pnpm`, `wrangler`), and a pathspec cannot separate the two (issue #70).
#
# `cleanup.yml` deliberately does not consume this: it stays unfiltered so a
# close whose final diff is docs-only still reaps a Neon branch an earlier push
# created (issue #66).
#
# The list deliberately does not name this module. Editing the definition does
# not change a build, so it must not force a deploy; the workflow-lint job lints
# `scripts/**/*.sh` on every pull request (issue #61), and both gates run the
# module whenever a real change flows through them.
#
# Source it, then:
#
#   . scripts/code-relevant-paths.sh
#   code_relevant_paths            # canonical pathspecs, one per line
#   code_relevant_paths preview    # ... plus the Preview-only workflow self-test
#
#   detect_code_relevant_change "$BASE" "$HEAD" [preview]
#     # 0 = a code-relevant path changed
#     # 1 = none changed
#     # 2 = undetermined (a missing object, an unusable baseline)
#
#   emit_code_relevant_change "$BASE" "$HEAD" [preview]
#     # Publishes `code_changed=true|false` for a step output, failing open:
#     # only a definitive "none changed" is false. Requires `GITHUB_OUTPUT`.
#
# Shellchecked by CI's workflow-lint job and lefthook's pre-commit hook, which
# walk `scripts/**/*.sh` (issue #61).

# The canonical pathspecs for `git diff`, one per line. `preview` adds the
# workflow self-test leg, which is deliberately Preview-only: `.github/actions/**`
# is canonical because the composite action chooses the toolchain and install
# flags the build uses, but a workflow file only controls when and how a job
# runs (ADR-0023).
code_relevant_paths() {
  printf '%s\n' \
    apps \
    packages \
    pnpm-lock.yaml \
    pnpm-workspace.yaml \
    turbo.json \
    package.json \
    fnox.toml \
    .mise.toml \
    .github/actions

  if [ "${1:-}" = preview ]; then
    printf '%s\n' .github/workflows
  fi
}

# Classify the diff `$base`..`$head` against the code-relevant paths. Returns 0
# when a code-relevant path changed, 1 when none did, and 2 when `git diff`
# could not answer. `emit_code_relevant_change` maps that to the shared
# fail-open policy both gates use.
#
# Errexit-safe: `git diff --quiet` exits 1 as its normal "changes found" signal,
# so it is guarded in an `if` to suspend errexit for that command and classify
# the status instead of aborting. GitHub runs `run:` blocks as `bash -e`, and a
# step's `set -uo pipefail` does not clear that inherited errexit (issue #97);
# guarding the diff here means no caller needs `set +e` around it. The function
# still returns its classified status like any command, so a caller that wants
# the code rather than the abort calls it from an `if` (as
# `emit_code_relevant_change` does).
detect_code_relevant_change() {
  local base=$1
  local head=$2
  local mode=${3:-}
  local paths=()
  local pathspec diff_status

  while IFS= read -r pathspec; do
    paths+=("$pathspec")
  done < <(code_relevant_paths "$mode")

  if git diff --quiet "$base" "$head" -- "${paths[@]}"; then
    diff_status=0
  else
    diff_status=$?
  fi

  case "$diff_status" in
    0) return 1 ;;
    1) return 0 ;;
    *) return 2 ;;
  esac
}

# Publish the classification as a step's `code_changed` output and echo what was
# decided, so each gate's log explains itself. Fails open: `true` when a
# code-relevant path changed or the diff could not be classified, `false` only
# on a definitive "no change". Both gates share this, so their policy cannot
# drift either. Requires `GITHUB_OUTPUT` in the environment.
emit_code_relevant_change() {
  local base=$1
  local head=$2
  local mode=${3:-}
  local result diff_status

  if detect_code_relevant_change "$base" "$head" "$mode"; then
    result=true
    echo "Code-relevant changes detected in $base..$head."
  else
    diff_status=$?
    case "$diff_status" in
      1)
        result=false
        echo "No code-relevant changes in $base..$head; skipping."
        ;;
      *)
        result=true
        echo "::warning::Could not determine code-relevant changes in $base..$head (exit $diff_status); running to be safe."
        ;;
    esac
  fi

  echo "code_changed=$result" >> "$GITHUB_OUTPUT"
}
