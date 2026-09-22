#!/usr/bin/env bash
#
# The one definition of a per-PR preview's identifiers (issue #78).
#
# A preview has four names:
#   - the Workers preview alias / Pages branch alias: `pr<N>-<slug>`, falling
#     back to `pr-<N>` when nothing slugs at all;
#   - the Pages deployment prefix: `pr<N>-`, which matches every deployment the
#     PR ever made, including ones orphaned by a rename;
#   - the Neon branch name: `pr-<N>`, internal and number-keyed so a rename
#     cannot orphan it;
#   - the GitHub deployment environment: `preview/pr-<N>`, number-keyed for the
#     same reason and named here because referencing an environment auto-creates
#     it and nothing reaps it (issue #154).
#
# The slug is decoration, and it comes from the pull request *title* — the text
# a human wrote, and the text that describes the PR in review — with the
# Conventional Commit prefix (`docs(db): ...`) stripped so the slug starts with
# the subject. It falls back to the source branch when the title sanitizes
# away (an emoji-only title, say) and to the number-keyed name when both do.
# An over-long slug is cut on a word boundary, filler words first, so the
# visible part reads as words — only a single word too long to fit is cut
# mid-word, having no boundary to cut at.
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
#   env_name=$(preview_environment_name "$PR_NUMBER")            # preview/pr-<N>
#
# `scripts/preview-identifiers.test.sh` pins the cases; CI runs it in the
# `lint-workflows-and-scripts` job. This file is also shellchecked by CI and
# lefthook's pre-commit hook (issue #61).

# The slug budget for `pr<N>-<slug>`: Cloudflare Pages truncates the branch
# alias this becomes to 28 characters (`<alias>.vmb-web.pages.dev`), so a longer
# alias resolves at a *different* address than the one the workflow computes.
# 28 is stricter than the Workers side (`<alias>-vmb-api` must fit a
# 63-character DNS label), so it is the binding limit: `pr` + the number + `-`
# costs `${#pr_number} + 3`, leaving `25 - ${#pr_number}` for the slug. Pages
# may also append a disambiguating suffix when the truncated alias is already
# taken, so `preview.yml` posts the web URL `wrangler` reports; this string is
# what the Workers `<alias>-vmb-api` URL and the cleanup prefix use verbatim.
preview_slug_limit() {
  local limit=$((25 - ${#1}))

  if [ "$limit" -lt 1 ]; then
    limit=1
  fi

  printf '%s' "$limit"
}

# Sanitize arbitrary text into a DNS-label-safe slug, uncapped: lowercase, runs
# of non-alphanumerics collapsed to a single dash, trimmed at both ends. Falls
# back to nothing when the text sanitizes entirely away; callers decide what
# that means.
preview_sanitize() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

# `preview_sanitize` plus a hard cut at `max` characters, re-trimming any dash
# the cut leaves dangling. This is the last resort, for a single word too long
# to fit whole: with no boundary to cut at, a slug can still end mid-word.
preview_slug() {
  preview_sanitize "$1" | cut -c1-"$2" | sed -E 's/-+$//'
}

# The words of a sanitized slug, one per line. Both helpers below walk a slug
# word by word, so the split lives here rather than in each of them.
preview_words() {
  printf '%s' "$1" | tr '-' '\n'
}

# The longest run of whole words from a sanitized slug that fits in `max`
# characters, so the cut reads as words instead of chopping one in half. Two
# consequences are deliberate: the result can be shorter than the budget (the
# next whole word did not fit), and only a first word that cannot fit alone is
# cut mid-word, since it has no boundary to cut at.
preview_fit_words() {
  local text=$1
  local max=$2
  local out=""
  local word
  local candidate

  while IFS= read -r word; do
    [ -n "$word" ] || continue

    if [ -z "$out" ]; then
      candidate=$word
    else
      candidate="$out-$word"
    fi

    if [ "${#candidate}" -le "$max" ]; then
      out=$candidate
    else
      break
    fi
  done <<< "$(preview_words "$text")"

  if [ -z "$out" ]; then
    preview_slug "$text" "$max"
  else
    printf '%s' "$out"
  fi
}

# A sanitized slug with its filler words removed. `preview_title_slug` calls
# this only when the slug does not fit as it stands: a slug that fits keeps
# every word it has.
preview_drop_fillers() {
  local out=""
  local word

  while IFS= read -r word; do
    [ -n "$word" ] || continue

    case "$word" in
    and | the | for | to | of | a) continue ;;
    esac

    if [ -z "$out" ]; then
      out=$word
    else
      out="$out-$word"
    fi
  done <<< "$(preview_words "$1")"

  printf '%s' "$out"
}

# The pull request title, minus the Conventional Commit prefix the repo's
# titles carry, cut to fit `max`. A title that is only a prefix sanitizes to
# nothing, exactly like a title with nothing slug-safe in it. Order matters:
# filler words go before any word is cut, and a word is only cut when no whole
# word fits (`Kubernetesconfiguration` has nowhere else to cut).
preview_title_slug() {
  local max=$2
  local subject
  local slug

  subject=$(printf '%s' "$1" \
    | sed -E 's/^[A-Za-z]+(\([^)]*\))?!?:[[:space:]]*//')
  slug=$(preview_sanitize "$subject")

  if [ "${#slug}" -le "$max" ]; then
    printf '%s' "$slug"
    return
  fi

  slug=$(preview_drop_fillers "$slug")
  if [ "${#slug}" -le "$max" ]; then
    printf '%s' "$slug"
    return
  fi

  preview_fit_words "$slug" "$max"
}

# The source branch, sanitized and cut on a word boundary. Fillers are not
# dropped here: a branch name is deliberately structured (`fix/api/session…`),
# so removing words would change what it says rather than tighten it.
preview_branch_slug() {
  preview_fit_words "$(preview_sanitize "$1")" "$2"
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
    slug=$(preview_branch_slug "$head_ref" "$max")
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

# The GitHub deployment environment `preview/pr-<N>` (issue #154). GitHub
# auto-creates an environment when a deployment names one and never reaps it, so
# this is a resource like the Neon branch, not a label: number-keyed so a
# retitle cannot orphan it, and defined here so `preview.yml` (which registers
# the deployment) and `cleanup.yml` (which deletes the environment) cannot
# disagree — a second inline literal on either side would strand an environment
# forever. The `preview/` prefix is a namespace, not a second key: it groups
# these per-PR environments away from any hand-made one.
preview_environment_name() {
  local number_name
  number_name=$(preview_number_name "$1")

  printf 'preview/%s' "$number_name"
}
