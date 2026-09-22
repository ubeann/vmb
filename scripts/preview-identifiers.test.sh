#!/usr/bin/env bash
#
# Tests for the preview identifier scheme (`preview-identifiers.sh`).
#
# The alias is the only one of the four names that is decoration, but it is
# decoration with a hard budget: Cloudflare Pages truncates the branch alias it
# becomes to 28 characters, so anything longer resolves at a different address
# than the one we compute. (The Workers side is looser: `<alias>-vmb-api` has to
# fit a 63-character DNS label.) The cases below pin the sources (title, then
# branch, then number), the Conventional Commit prefix strip, the sanitizer and
# the cap.
#
# Run from anywhere: `bash scripts/preview-identifiers.test.sh`. CI runs it in
# the `lint-workflows-and-scripts` job, and lefthook runs it on a commit that
# touches this module or this file.

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

check "a conventional title loses its prefix and is capped" \
  "pr148-record-no-standing-dev" \
  "$(preview_alias 148 \
    "docs(db): record no standing dev branch and rescope the import to a cutover rehearsal" \
    "docs/db/no-standing-dev-branch")"

check "a title without a prefix is used as it stands" \
  "pr9-fix-the-trucking-invoice" \
  "$(preview_alias 9 "Fix the trucking invoice rounding bug" "whatever")"

check "punctuation and case sanitize" \
  "pr5-handle-null-quotes-v2" \
  "$(preview_alias 5 "Fix: handle NULL & 'Quotes' (v2)!" "feature/rounding")"

check "a prefix-only title has nothing left to slug" \
  "pr12-docs-db-thing" \
  "$(preview_alias 12 "docs(db):" "docs/db/thing")"

# ── The branch is the fallback, for titles that sanitize away ────────────────

check "an emoji-only title falls back to the branch" \
  "pr42-feature-trucking-roundi" \
  "$(preview_alias 42 "🚀✨" "feature/trucking/rounding")"

check "an uppercase branch fallback is lowercased" \
  "pr4-feature-upper-case" \
  "$(preview_alias 4 "" "Feature/UPPER_Case")"

check "a long branch fallback is capped and re-trimmed" \
  "pr3-feature-trucking-very-lo" \
  "$(preview_alias 3 "" "feature/trucking/very-long-branch-name-that-keeps-going-and-going-and-going")"

# ── The number is the last resort, and the cap leaves room for the suffix ────

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

# ── The other three names are number-keyed and do not move ──────────────────

check "the Neon branch name is number-keyed" "pr-148" "$(preview_neon_branch 148)"
check "the Pages prefix is number-keyed" "pr148-" "$(preview_pages_prefix 148)"
check "the number-keyed name is shared by both" "pr-9" "$(preview_number_name 9)"
check "the deployment environment is number-keyed" "preview/pr-148" "$(preview_environment_name 148)"

# ── The sanitizer on its own ────────────────────────────────────────────────

check "the sanitizer lowercases, collapses and trims" \
  "hello-world" \
  "$(preview_slug "  Hello, -- World!  " 32)"
check "the sanitizer caps" \
  "abcdefghij" \
  "$(preview_slug "abcdefghijklmno" 10)"

# ── Report ──────────────────────────────────────────────────────────────────

printf '\n%d checks, %d failing\n' "$checks" "$failures"
if [ "$failures" -gt 0 ]; then
  exit 1
fi
