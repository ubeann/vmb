#!/usr/bin/env bash
#
# Shared Neon preview-branch helpers.
#
# A preview's Neon branch carries the same `pr<N>-<slug>` name as its Workers
# alias (ADR-0029), so both workflows that touch it work from the two strings
# `scripts/preview-identifiers.sh` defines: the `pr<N>-` prefix and the `pr-<N>`
# fallback. `preview.yml` renames the branch when a retitle moves the alias, and
# `cleanup.yml` deletes every branch the PR owns when it closes. Keeping the
# lookup, the rename and the delete here means the match predicate cannot drift
# between them — the same reason `pages-preview-deployments.sh` exists for the
# Pages side.
#
# A rename is a label change, not a move: the branch keeps its id, its endpoint
# host and its `app` database, so a live preview's connection string keeps
# working and the branch is never deleted and recreated (which would throw away
# the rows and the migration journal the next run reuses).
#
# Failing functions return non-zero and write the reason to stderr; both callers
# treat that as fatal, because a missed rename or delete leaves the environment
# wrong rather than merely untidy.
#
# Source it, then call the functions:
#
#   . scripts/neon-preview-branches.sh
#   neon_matching_branches "$PROJECT_ID" "$API_KEY" "$prefix" "$fallback"  # id<TAB>name
#   neon_rename_branch "$PROJECT_ID" "$API_KEY" "$branch_id" "$new_name"
#   neon_delete_branch "$PROJECT_ID" "$API_KEY" "$branch_id"
#
# Shellchecked by CI's workflow-lint job and lefthook's pre-commit hook, which
# walk `scripts/**/*.sh` (issue #61).

# Named so a future host change is one edit, and prefixed so a sourced module
# cannot collide with a caller's variables.
NEON_PREVIEW_API_BASE="https://console.neon.tech/api/v2"

# Every branch of the project that is this PR's fallback name or starts with its
# prefix, as `<id>\t<name>` lines.
#
# `search` narrows server-side (it matches a partial name or id) and `limit` is
# past any plan's branch cap for a project that reaps preview branches at close
# and expires them after 30 days, so a match cannot hide on a second page. The
# names are matched here rather than trusted from the search: `search=pr` also
# matches `production`, and searching by the number alone would match unrelated
# branches.
neon_matching_branches() {
  local project_id=$1
  local api_key=$2
  local prefix=$3
  local fallback=$4
  local response status body

  # `-sS` without `-f`: a non-2xx must stay inspectable so Neon's own message is
  # printed rather than collapsing to a bare `curl: (22)`.
  if ! response=$(curl -sS -w '\n%{http_code}' \
    -H "Authorization: Bearer $api_key" \
    "$NEON_PREVIEW_API_BASE/projects/$project_id/branches?limit=100&search=pr"); then
    echo "Could not reach the Neon API to list branches." >&2
    return 1
  fi

  status=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')
  case "$status" in
  2??) ;;
  *)
    echo "Listing Neon branches failed (HTTP $status): $body" >&2
    return 1
    ;;
  esac

  printf '%s' "$body" | jq -r --arg prefix "$prefix" --arg fallback "$fallback" \
    '.branches[]? | select((.name == $fallback) or (.name | startswith($prefix))) | "\(.id)\t\(.name)"'
}

# Rename one branch. The API takes a PATCH of the name alone.
neon_rename_branch() {
  local project_id=$1
  local api_key=$2
  local branch_id=$3
  local new_name=$4
  local response status body

  if ! response=$(curl -sS -w '\n%{http_code}' -X PATCH \
    -H "Authorization: Bearer $api_key" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg name "$new_name" '{branch: {name: $name}}')" \
    "$NEON_PREVIEW_API_BASE/projects/$project_id/branches/$branch_id"); then
    echo "Could not reach the Neon API to rename branch $branch_id." >&2
    return 1
  fi

  status=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')

  case "$status" in
  2??)
    echo "Renamed Neon branch $branch_id to '$new_name'."
    return 0
    ;;
  *)
    echo "Renaming Neon branch $branch_id failed (HTTP $status): $body" >&2
    return 1
    ;;
  esac
}

# Delete one branch. Returns 0 when it is gone (2xx) or already gone (404),
# printing which; returns non-zero with the status and body on stderr for any
# other outcome (auth, permissions, 5xx).
neon_delete_branch() {
  local project_id=$1
  local api_key=$2
  local branch_id=$3
  local response status body

  if ! response=$(curl -sS -w '\n%{http_code}' -X DELETE \
    -H "Authorization: Bearer $api_key" \
    "$NEON_PREVIEW_API_BASE/projects/$project_id/branches/$branch_id"); then
    echo "Could not reach the Neon API to delete branch $branch_id." >&2
    return 1
  fi

  status=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')

  case "$status" in
  2??)
    echo "Deleted Neon branch $branch_id."
    return 0
    ;;
  404)
    echo "Neon branch $branch_id was already gone."
    return 0
    ;;
  *)
    echo "Failed to delete Neon branch $branch_id (HTTP $status): $body" >&2
    return 1
    ;;
  esac
}
