#!/usr/bin/env bash
#
# Shared Pages preview-deployment helpers (issue #84).
#
# A PR's Pages preview deployments are found by the `pr<N>-` prefix / `pr-<N>`
# fallback from `scripts/preview-identifiers.sh` (issue #78). Two workflows need
# that lookup and the delete that follows: `preview.yml` prunes a PR's
# superseded deployments after each successful deploy, and `cleanup.yml`
# deletes the remaining ones when the PR closes. Keeping both here means the
# pagination, the `per_page` cap, and the match predicate cannot drift between
# the per-push prune and the close-time sweep.
#
# Failing functions return non-zero and write the reason to stderr; the caller
# decides whether that is fatal (Cleanup fails hard, Preview warns and moves on)
# so the two can share one implementation without sharing a failure policy.
#
# Source it, then call the functions:
#
#   . scripts/pages-preview-deployments.sh
#   pages_matching_deployments "$ACCOUNT_ID" "$TOKEN" "$PROJECT" "$prefix" "$fallback"
#   pages_delete_deployment "$ACCOUNT_ID" "$TOKEN" "$PROJECT" "$deployment_id"
#
# Shellchecked by CI's workflow-lint job and lefthook's pre-commit hook, which
# walk `scripts/**/*.sh` (issue #61).

# Every Pages preview deployment for the project whose branch is the PR's
# fallback or starts with its prefix, as `<created_on>\t<id>` lines, newest
# first. A caller that wants only the ids pipes through `cut -f2`; a caller that
# keeps the newest (the one a deploy just made) drops the first line.
#
# Paginates: the deployments endpoint caps `per_page` at 25 and a match on a
# later page would otherwise leak. Ordering is computed here rather than trusted
# from the API, and with `LC_ALL=C` so the ISO-8601 `created_on` sort is not
# locale-dependent.
pages_matching_deployments() {
  local account_id=$1
  local token=$2
  local project_name=$3
  local prefix=$4
  local fallback=$5
  local page=1
  local response status body page_matches total_pages
  local matches=""

  while :; do
    # `-sS` without `-f`: a non-2xx must stay inspectable so the Cloudflare
    # error body is printed rather than collapsing to a bare `curl: (22)`.
    if ! response=$(curl -sS -w '\n%{http_code}' \
      -H "Authorization: Bearer $token" \
      "https://api.cloudflare.com/client/v4/accounts/$account_id/pages/projects/$project_name/deployments?env=preview&per_page=25&page=$page"); then
      echo "Could not reach the Cloudflare API to list Pages deployments." >&2
      return 1
    fi

    status=$(printf '%s' "$response" | tail -n1)
    body=$(printf '%s' "$response" | sed '$d')
    if [ "$status" -lt 200 ] || [ "$status" -ge 300 ]; then
      echo "Listing Pages deployments failed (HTTP $status): $body" >&2
      return 1
    fi

    page_matches=$(printf '%s' "$body" \
      | jq -r --arg prefix "$prefix" --arg fallback "$fallback" \
        '.result[]? | select(((.deployment_trigger.metadata.branch // "") == $fallback) or ((.deployment_trigger.metadata.branch // "") | startswith($prefix))) | "\(.created_on // "")\t\(.id)"')
    if [ -n "$page_matches" ]; then
      matches="${matches}${page_matches}"$'\n'
    fi

    total_pages=$(printf '%s' "$body" | jq -r '.result_info.total_pages // 1')
    if [ "$page" -ge "$total_pages" ]; then
      break
    fi
    page=$((page + 1))
  done

  printf '%s' "$matches" | sed '/^$/d' | LC_ALL=C sort -r
}

# Delete one Pages preview deployment, forcing past any latest-for-branch guard.
# Returns 0 when it is gone (2xx) or already gone (404), printing which; returns
# non-zero with the status and body on stderr for any other outcome (auth,
# permissions, 5xx), which the caller treats as fatal or not.
pages_delete_deployment() {
  local account_id=$1
  local token=$2
  local project_name=$3
  local deployment_id=$4
  local response status body

  if ! response=$(curl -sS -w '\n%{http_code}' -X DELETE \
    -H "Authorization: Bearer $token" \
    "https://api.cloudflare.com/client/v4/accounts/$account_id/pages/projects/$project_name/deployments/$deployment_id?force=true"); then
    echo "Could not reach the Cloudflare API to delete Pages deployment $deployment_id." >&2
    return 1
  fi

  status=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')

  case "$status" in
    2??)
      echo "Deleted Pages deployment $deployment_id."
      return 0
      ;;
    404)
      echo "Pages deployment $deployment_id was already gone."
      return 0
      ;;
    *)
      echo "Failed to delete Pages deployment $deployment_id (HTTP $status): $body" >&2
      return 1
      ;;
  esac
}
