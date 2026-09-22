#!/usr/bin/env bash
#
# The one definition of a per-PR preview's identifiers (issue #78).
#
# A preview has two names, one prefix, and one deployment environment:
#   - the alias: `pr<N>-<slug>`, falling back to `pr-<N>` when nothing slugs at
#     all. It is the Workers preview alias, the Neon branch name, and the Pages
#     branch alias as far as Cloudflare lets it be (it truncates, and appends a
#     disambiguating suffix on collision, which is why the workflow posts the
#     URL `wrangler` reports rather than one computed from this);
#   - the prefix: `pr<N>-`. Every reaper matches the prefix or the fallback name
#     exactly — the Pages deployment sweep and the Neon branch delete — so a
#     retitle cannot orphan either, whatever the slug became;
#   - the GitHub deployment environment: `preview/pr-<N>`, number-keyed rather
#     than slugged because the environments endpoint deletes by exact name and
#     nothing matches a prefix there, so a retitle must not move it; named here
#     because referencing an environment auto-creates it and nothing reaps it
#     (issue #154).
#
# The slug is decoration, and it comes from the pull request *title* — the text
# a human wrote, and the text that describes the PR in review — with the
# Conventional Commit prefix (`docs(db): ...`) stripped so the slug starts with
# the subject. It falls back to the source branch when the title sanitizes
# away (an emoji-only title, say) and to the number-keyed name when both do.
# An over-long slug is cut on a word boundary, filler words first, so the
# visible part reads as words — only a single word too long to fit is cut
# mid-word, having no boundary to cut at.
# A title is mutable, so retitling moves the alias on the next push. That is
# safe on both sides: the Pages sweep matches the prefix and keeps the newest
# deployment, and `preview.yml` renames the PR's Neon branch to the new alias
# rather than leaving the old one behind.
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
#   prefix=$(preview_prefix "$PR_NUMBER")                        # pr<N>-
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
# what the Workers `<alias>-vmb-api` URL, the Neon branch name and the cleanup
# prefix all use verbatim.
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

# The number-keyed name `pr-<N>`: the alias's last resort, when neither the
# title nor the branch name slugs to anything. Every reaper matches it by exact
# name as well as by prefix; worker aliases must start with a lowercase letter,
# which the `pr` prefix guarantees.
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

# The prefix `pr<N>-`. Both reapers match it rather than the current alias so a
# retitle (`pr<N>-<old>` -> `pr<N>-<new>`) cannot orphan the old slug's Pages
# deployments or leave the old Neon branch behind.
preview_prefix() {
  printf 'pr%s-' "$1"
}

# True when a name belongs to this PR: the fallback name exactly, or anything
# under the prefix. This is the rule both reapers apply — the Pages sweep
# expresses it in jq for its paginated list, and
# `scripts/neon-preview-branches.sh` calls this — so a naming change cannot make
# one reaper miss what the other finds.
preview_name_matches() {
  local prefix
  local fallback

  prefix=$(preview_prefix "$1")
  fallback=$(preview_number_name "$1")

  [ "$2" = "$fallback" ] || [ "${2#"$prefix"}" != "$2" ]
}

# The GitHub deployment environment `preview/pr-<N>` (issue #154). GitHub
# auto-creates an environment when a deployment names one and never reaps it, so
# this is a resource like the Neon branch, not a label; and unlike the branch —
# which every reaper finds by prefix or fallback, so a retitle merely renames it
# — the environments endpoint deletes by exact name, so a retitle must not move
# it. Number-keyed for that reason, and defined here so `preview.yml` (which
# registers the deployment) and `cleanup.yml` (which deletes the environment)
# cannot disagree: a second inline literal on either side would strand an
# environment forever. The `preview/` prefix is a namespace, not a second key:
# it groups these per-PR environments away from any hand-made one.
preview_environment_name() {
  local number_name
  number_name=$(preview_number_name "$1")

  printf 'preview/%s' "$number_name"
}
