#!/usr/bin/env bash
#
# The one definition of a per-PR preview's identifiers (issue #78).
#
# A preview has three names:
#   - the Workers preview alias / Pages branch alias: `pr<N>-<slug>`, falling
#     back to `pr-<N>` when nothing slugs at all;
#   - the Pages deployment prefix: `pr<N>-`, which matches every deployment the
#     PR ever made, including ones orphaned by a rename;
#   - the Neon branch name: `pr-<N>`, internal and number-keyed so a rename
#     cannot orphan it.
#
# The slug is decoration, and it comes from the pull request *title* — the text
# a human wrote, and the text that describes the PR in review — with the
# Conventional Commit prefix (`docs(db): ...`) stripped so the slug starts with
# the subject. It falls back to the source branch when the title sanitizes
# away (an emoji-only title, say) and to the number-keyed name when both do.
# A title is mutable, so retitling moves the alias on the next push; that is
# safe because nothing that outlives a run is derived from the slug: cleanup
# matches the `pr<N>-` prefix and deletes the Neon branch by `pr-<N>`, so an
# old slug leaves no orphan.
#
# `preview.yml` mints these when it creates the environment; `cleanup.yml`
# re-derives them independently when it destroys it. Keeping the scheme here,
# sourced by both, is what stops a later change to the naming from making
# create and destroy disagree and silently orphan a Pages deployment or Neon
# branch.
#
# Source it, then call the functions:
#
#   . scripts/preview-identifiers.sh
#   alias=$(preview_alias "$PR_NUMBER" "$PR_TITLE" "$HEAD_REF")  # pr<N>-<slug> | pr-<N>
#   prefix=$(preview_pages_prefix "$PR_NUMBER")                  # pr<N>-
#   branch=$(preview_neon_branch "$PR_NUMBER")                   # pr-<N>
#
# `scripts/preview-identifiers.test.sh` pins the cases; CI runs it in the
# `lint-workflows-and-scripts` job. This file is also shellchecked by CI and
# lefthook's pre-commit hook (issue #61).

# The slug budget for `pr<N>-<slug>`: Cloudflare Pages truncates the branch
# alias this becomes to 28 characters (`<alias>.vmb-web.pages.dev`), so a longer
# alias resolves at a *different* address than the one computed here — the
# truncated one. 28 is stricter than the Workers side (`<alias>-vmb-api` must
# fit a 63-character DNS label), so it is the binding limit: `pr` + the number +
# `-` costs `${#pr_number} + 3`, leaving `25 - ${#pr_number}` for the slug.
preview_slug_limit() {
  local limit=$((25 - ${#1}))

  if [ "$limit" -lt 1 ]; then
    limit=1
  fi

  printf '%s' "$limit"
}

# Sanitize arbitrary text into a DNS-label-safe slug: lowercase, runs of
# non-alphanumerics collapsed to a single dash, trimmed at both ends, and
# capped at `max` (re-trimming any dash the cut leaves dangling). Falls back to
# nothing when the text sanitizes entirely away; callers decide what that
# means.
preview_slug() {
  local text=$1
  local max=$2

  printf '%s' "$text" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-"$max" \
    | sed -E 's/-+$//'
}

# The pull request title, minus the Conventional Commit prefix the repo's
# titles carry, then sanitized. A title that is only a prefix sanitizes to
# nothing, exactly like a title with nothing slug-safe in it.
preview_title_slug() {
  local title=$1
  local max=$2
  local subject

  subject=$(printf '%s' "$title" \
    | sed -E 's/^[A-Za-z]+(\([^)]*\))?!?:[[:space:]]*//')

  preview_slug "$subject" "$max"
}

# The number-keyed name `pr-<N>`. It is the one string shared by the Neon
# branch and by the alias/Pages fallback; worker aliases must start with a
# lowercase letter, which the `pr` prefix guarantees.
preview_number_name() {
  printf 'pr-%s' "$1"
}

# The Workers preview alias and Pages branch alias: `pr<N>-<slug>` from the
# title, then the branch, or the number-keyed name when neither slugs.
preview_alias() {
  local pr_number=$1
  local title=$2
  local head_ref=$3
  local max slug

  max=$(preview_slug_limit "$pr_number")
  slug=$(preview_title_slug "$title" "$max")
  if [ -z "$slug" ]; then
    slug=$(preview_slug "$head_ref" "$max")
  fi

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
