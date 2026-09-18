#!/usr/bin/env sh
#
# Run each package's own eslint over the staged files it owns.
#
# Run by lefthook's `pre-commit` command (issue #62). eslint is a per-package
# devDependency with a per-package flat config and no root binary, so a staged
# file is mapped to the nearest ancestor holding an `eslint.config.*` and eslint
# is run from there, where both the binary and the config resolve.
#
# Usage: scripts/lint-staged-eslint.sh <file>...

set -eu

[ "$#" -gt 0 ] || exit 0

tmp=$(mktemp)
roots=$(mktemp)
trap 'rm -f "$tmp" "$roots"' EXIT

for file in "$@"; do
  case "$file" in
    *.js | *.mjs | *.cjs | *.ts | *.tsx | *.svelte) ;;
    *) continue ;;
  esac
  [ -f "$file" ] || continue

  dir=$(dirname "$file")
  root=""
  while [ "$dir" != "." ] && [ "$dir" != "/" ]; do
    for config in js mjs cjs ts; do
      if [ -f "$dir/eslint.config.$config" ]; then
        root=$dir
        break 2
      fi
    done
    dir=$(dirname "$dir")
  done
  [ -n "$root" ] || continue

  # Path relative to the package, so eslint runs from the package root.
  printf '%s|%s\n' "$root" "${file#"$root"/}" >>"$tmp"
done

[ -s "$tmp" ] || exit 0

cut -d'|' -f1 "$tmp" | sort -u >"$roots"

status=0
while IFS= read -r root; do
  set --
  while IFS='|' read -r owner file; do
    [ "$owner" = "$root" ] || continue
    set -- "$@" "$file"
  done <"$tmp"

  (cd "$root" && pnpm exec eslint --no-warn-ignored "$@") || status=1
done <"$roots"

exit "$status"
