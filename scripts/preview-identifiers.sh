#!/usr/bin/env bash
#
# The one definition of a per-PR preview's identifiers (issue #78).
#
# A preview has three names, all derived from the immutable PR number plus the
# (mutable) source branch:
#   - the Workers preview alias / Pages branch alias: `pr<N>-<slug>`, falling
#     back to `pr-<N>` when the branch name sanitizes to nothing;
#   - the Pages deployment prefix: `pr<N>-`, which matches every deployment the
#     PR ever made, including ones orphaned by a branch rename;
#   - the Neon branch name: `pr-<N>`, internal and number-keyed so a branch
#     rename cannot orphan it.
#
# `preview.yml` mints these when it creates the environment; `cleanup.yml`
# re-derives them independently when it destroys it. Keeping the scheme here,
# sourced by both, is what stops a later change to the naming from making
# create and destroy disagree and silently orphan a Pages deployment or Neon
# branch.
#
# Behaviour-preserving: the strings produced for a given PR number and branch
# name must not change. Source it, then call the functions:
#
#   . scripts/preview-identifiers.sh
#   alias=$(preview_alias "$PR_NUMBER" "$HEAD_REF")     # pr<N>-<slug> | pr-<N>
#   prefix=$(preview_pages_prefix "$PR_NUMBER")         # pr<N>-
#   branch=$(preview_neon_branch "$PR_NUMBER")          # pr-<N>
#
# This file is shellchecked by CI's workflow-lint job and lefthook's
# pre-commit hook (issue #61).

# Sanitize a branch name the way Cloudflare does: lowercase, runs of
# non-alphanumerics collapsed to a single dash, trimmed at both ends, and
# capped at 32 chars so `<alias>-vmb-api` stays inside the 63-char DNS label
# limit (re-trimming any dash the cut leaves dangling). Falls back to nothing
# when the name sanitizes entirely away; callers decide what that means.
preview_slug() {
  local head_ref=$1
  local slug

  slug=$(printf '%s' "$head_ref" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-32 \
    | sed -E 's/-+$//')

  printf '%s' "$slug"
}

# The number-keyed name `pr-<N>`. It is the one string shared by the Neon
# branch and by the alias/Pages fallback; worker aliases must start with a
# lowercase letter, which the `pr` prefix guarantees.
preview_number_name() {
  printf 'pr-%s' "$1"
}

# The Workers preview alias and Pages branch alias: `pr<N>-<slug>`, or the
# number-keyed name when the branch name sanitizes to nothing.
preview_alias() {
  local pr_number=$1
  local head_ref=$2
  local slug

  slug=$(preview_slug "$head_ref")
  if [ -n "$slug" ]; then
    printf 'pr%s-%s' "$pr_number" "$slug"
  else
    preview_number_name "$pr_number"
  fi
}

# The Pages deployment prefix `pr<N>-`. Cleanup matches this prefix rather than
# the current branch name so a rename (`pr<N>-<old>` -> `pr<N>-<new>`) cannot
# orphan the old slug's deployments.
preview_pages_prefix() {
  printf 'pr%s-' "$1"
}

# The Neon branch name `pr-<N>`. Deliberately the same string as the alias and
# Pages fallback, but named for this caller's purpose so the two cannot drift
# apart; the delegation to `preview_number_name` is the point, not indirection
# for its own sake.
preview_neon_branch() {
  preview_number_name "$1"
}
