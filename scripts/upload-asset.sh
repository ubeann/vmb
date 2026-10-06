#!/usr/bin/env bash
#
# Upload an image to the private `ubeann/vmb-assets` repo and print a Markdown
# image link for an issue or PR body. `gh` cannot attach files to issues, so
# this is how a ticket keeps the screenshots it was shaped from, and how a PR
# shows its evidence. Only people with access to vmb-assets see the images.
#
# The file name gets a content-hash prefix, so uploading the same file twice
# prints the same link without writing a second copy, and a link never changes
# what it shows. To replace an image, upload the new one and swap the link.
#
# Usage: scripts/upload-asset.sh <file> [<folder>]
#   <folder>  where it goes in vmb-assets, e.g. `issues/301` or `prs/320`
#             (default `misc`)
#        scripts/upload-asset.sh --delete <link-or-path>
#   Removes an image uploaded by mistake. It stays in vmb-assets' git history;
#   an image that leaked a secret needs that history rewritten as well.
# Override the repo with VMB_ASSETS_REPO=<owner>/<name>.

set -euo pipefail

repo=${VMB_ASSETS_REPO:-ubeann/vmb-assets}

if [ "${1:-}" = "--delete" ]; then
  target=${2:?usage: upload-asset.sh --delete <link-or-path>}
  # Accept the printed Markdown link, the bare URL, or the path itself.
  path=${target#*/blob/main/}
  path=${path%%\?*}
  path=${path%)}
  sha=$(gh api "repos/$repo/contents/$path" --jq .sha 2>/dev/null) || {
    echo "upload-asset: nothing at $path in $repo" >&2
    exit 1
  }
  gh api --method DELETE "repos/$repo/contents/$path" \
    -f message="Remove $path" -f sha="$sha" --silent
  echo "Removed $path"
  exit 0
fi

file=${1:?usage: upload-asset.sh <file> [<folder>] | upload-asset.sh --delete <link-or-path>}
folder=${2:-misc}

# The folder lands in a URL and a JSON string, so keep it to path characters.
case "$folder" in
  *[!A-Za-z0-9._/-]* | /* | *..*)
    echo "upload-asset: folder must be letters, digits, '.', '_', '-' and '/': $folder" >&2
    exit 1
    ;;
esac

[ -f "$file" ] || {
  echo "upload-asset: no such file: $file" >&2
  exit 1
}

hash=$(shasum -a 256 "$file" | cut -c1-12)
name=$(basename "$file" | tr -c 'A-Za-z0-9._\n-' '-')
path="$folder/$hash-$name"
link="![$name](https://github.com/$repo/blob/main/$path?raw=true)"

if gh api "repos/$repo/contents/$path" --silent 2>/dev/null; then
  printf '%s\n' "$link"
  exit 0
fi

# Stream the JSON body so a large image never becomes one huge argument.
{
  printf '{"message":"Add %s","content":"' "$path"
  base64 <"$file" | tr -d '\n'
  printf '"}'
} | gh api --method PUT "repos/$repo/contents/$path" --input - --silent

printf '%s\n' "$link"
