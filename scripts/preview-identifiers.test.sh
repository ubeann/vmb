#!/usr/bin/env bash
#
# Tests for the preview identifier scheme (`preview-identifiers.sh`).
#
# The alias is the only identifier here that is decoration, but it is
# decoration with a hard budget: Cloudflare Pages truncates the branch alias it
# becomes to 28 characters, so anything longer resolves at a different address
# than the one we compute. (The Workers side is looser: `<alias>-vmb-api` has to
# fit a 63-character DNS label.) The cases below pin the sources (title, then
# branch, then number), the Conventional Commit prefix strip, the sanitizer, and
# the way an over-long slug is cut: on a word boundary, with filler words dropped
# before any word is cut, and a hard cut only when no whole word fits.
#
# Run from anywhere: `bash scripts/preview-identifiers.test.sh`. CI runs it in
# the `Verify` job, and lefthook runs it on a commit that touches this module or
# this file.

set -euo pipefail

# Run from anywhere: the module sits next to this file.
cd "$(dirname "$0")"

# Sourced, not executed — SC1091 is suppressed because CI and lefthook run
# this linter without `-x`, so it cannot follow the source. The `source=` path
# is still given so the directive resolves if someone runs it with `-x`.
# shellcheck source=preview-identifiers.sh
# shellcheck disable=SC1091
. preview-identifiers.sh

failures=0
checks=0

check() {
  local description=$1 expected=$2 actual=$3

  checks=$((checks + 1))
  if [ "$expected" = "$actual" ]; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n       expected: %s\n       actual:   %s\n' "$description" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

# ── The title is the first source, minus its Conventional Commit prefix ──────

check "a conventional title loses its prefix and is cut to fit" \
  "pr148-record-no-standing-dev" \
  "$(preview_alias 148 \
    "docs(db): record no standing dev branch and rescope the import to a cutover rehearsal" \
    "docs/db/no-standing-dev-branch")"

check "a title without a prefix drops its fillers to fit" \
  "pr9-fix-trucking-invoice" \
  "$(preview_alias 9 "Fix the trucking invoice rounding bug" "whatever")"

check "punctuation and case sanitize" \
  "pr5-handle-null-quotes-v2" \
  "$(preview_alias 5 "Fix: handle NULL & 'Quotes' (v2)!" "feature/rounding")"

check "a prefix-only title has nothing left to slug" \
  "pr12-docs-db-thing" \
  "$(preview_alias 12 "docs(db):" "docs/db/thing")"

check "fillers are kept when the slug fits without dropping them" \
  "pr148-fix-the-invoice" \
  "$(preview_alias 148 "Fix the invoice" "x")"

check "fillers are dropped when the slug would not fit" \
  "pr148-fix-invoice-rounding" \
  "$(preview_alias 148 "Fix the invoice rounding" "x")"

check "a single word too long to fit is cut mid-word, having no boundary" \
  "pr148-kubernetesconfiguratio" \
  "$(preview_alias 148 "Kubernetesconfiguration" "x")"

# ── The branch is the fallback, for titles that sanitize away ────────────────

check "an emoji-only title falls back to the branch" \
  "pr42-feature-trucking" \
  "$(preview_alias 42 "🚀✨" "feature/trucking/rounding")"

check "an uppercase branch fallback is lowercased" \
  "pr4-feature-upper-case" \
  "$(preview_alias 4 "" "Feature/UPPER_Case")"

check "a long branch fallback is cut on a word boundary" \
  "pr3-feature-trucking-very" \
  "$(preview_alias 3 "" "feature/trucking/very-long-branch-name-that-keeps-going-and-going-and-going")"

check "the branch fallback keeps its words, fillers included" \
  "pr42-fix-to-the-invoice" \
  "$(preview_alias 42 "" "fix/to/the/invoice-rounding-bug")"

# ── The number is the last resort, and the cap leaves room for the suffix ────

check "an all-filler title drops to nothing and falls back to the branch" \
  "pr7-feature-thing" \
  "$(preview_alias 7 "and the for to of a and the for to of a" "feature/thing")"

check "nothing left to slug falls back to the number" \
  "pr-7" \
  "$(preview_alias 7 "🚀" "///")"

monster=$(preview_alias 148 "$(printf 'x%.0s' {1..200})" "")
check "a 200-character title fills the slug budget exactly" \
  "pr148-xxxxxxxxxxxxxxxxxxxxxx" \
  "$monster"
check "the alias fills Cloudflare Pages' 28-character branch-alias budget" \
  "28" \
  "$((${#monster}))"
check "the Workers label also stays inside its 63-character DNS limit" \
  "36" \
  "$((${#monster} + 8))"

monster5=$(preview_alias 99999 "$(printf 'x%.0s' {1..200})" "")
check "a five-digit PR number fills the budget exactly too" \
  "pr99999-xxxxxxxxxxxxxxxxxxxx" \
  "$monster5"
check "and its alias is still 28 characters" "28" "$((${#monster5}))"

# ── The prefix, and the rule both reapers match by ──────────────────────────

check "the prefix is number-keyed" "pr148-" "$(preview_prefix 148)"
check "the number-keyed fallback is the pr-<N> shape" "pr-9" "$(preview_number_name 9)"

# `preview_name_matches` is the rule both reapers apply: the fallback exactly,
# or anything under the prefix. The slug's source decides which shape an alias
# takes, so every source's output goes through the real predicate rather than a
# copy of it.
matches_rule() { # <pr> <name>
  if preview_name_matches "$1" "$2"; then
    printf 'match'
  else
    printf 'miss'
  fi
}

for spec in "148|a title long enough to be cut on a word boundary|branch" "7||branch" "9|🚀|///"; do
  IFS='|' read -r pr title ref <<< "$spec"
  check "pr $pr's alias is a name the reapers find ($(preview_alias "$pr" "$title" "$ref"))" \
    "match" \
    "$(matches_rule "$pr" "$(preview_alias "$pr" "$title" "$ref")")"
done

# Near misses must stay out: another PR's branch, a longer number, and the
# parent branch — `search=pr` returns `production`, which must never match.
check "another PR's branch does not match" "miss" "$(matches_rule 148 pr1489-x)"
check "a longer fallback does not match" "miss" "$(matches_rule 148 pr-1480)"
check "the parent branch does not match" "miss" "$(matches_rule 148 production)"
check "a dev branch does not match" "miss" "$(matches_rule 148 dev-76271600-ubeann)"
check "the fallback itself matches" "match" "$(matches_rule 148 pr-148)"

# ── The deployment environment is number-keyed and does not move ────────────

check "the deployment environment is number-keyed" "preview/pr-148" "$(preview_environment_name 148)"

# ── The sanitizer on its own ────────────────────────────────────────────────

check "the sanitizer lowercases, collapses and trims" \
  "hello-world" \
  "$(preview_slug "  Hello, -- World!  " 32)"
check "the sanitizer caps" \
  "abcdefghij" \
  "$(preview_slug "abcdefghijklmno" 10)"
check "the sanitizer itself is uncapped" \
  "hello-world" \
  "$(preview_sanitize "  Hello, -- World!  ")"
check "a hard cut re-trims the dash it lands on" \
  "hello" \
  "$(preview_slug "hello-world" 6)"

# ── Report ──────────────────────────────────────────────────────────────────

printf '\n%d checks, %d failing\n' "$checks" "$failures"
if [ "$failures" -gt 0 ]; then
  exit 1
fi
