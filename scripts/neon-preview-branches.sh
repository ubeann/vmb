#!/usr/bin/env bash
#
# Shared Neon preview-branch helpers.
#
# A preview's Neon branch carries the same `pr<N>-<slug>` name as its Workers
# alias (ADR-0029), so both workflows that touch it work from the names
# `scripts/preview-identifiers.sh` defines — source that module first: the
# lookup below calls its `preview_name_matches` rather than restating the rule.
# `preview.yml` renames the branch when a retitle moves the alias, renews its
# expiry on every run (the create action applies `expires_at` only when it
# creates a branch, issue #150), and `cleanup.yml` deletes every branch the PR
# owns when it closes. Keeping the lookup, the rename, the renewal and the
# delete here means the match cannot drift between them — the same reason
# `pages-preview-deployments.sh` exists for the Pages side.
#
# A rename is a label change, not a move: the branch keeps its id, its endpoint
# host and its `app` database, so a live preview's connection string keeps
# working and the branch is never deleted and recreated (which would throw away
# the rows and the migration journal the next run reuses).
#
# Failing functions return non-zero and write the reason to stderr; both callers
# treat that as fatal, because a missed rename, renewal or delete leaves the
# environment wrong rather than merely untidy.
#
# Source it, then call the functions:
#
#   . scripts/neon-preview-branches.sh
#   neon_matching_branches "$PROJECT_ID" "$API_KEY" "$PR_NUMBER"            # id<TAB>name
#   neon_branch_name "$PROJECT_ID" "$API_KEY" "$branch_id"                  # name
#   neon_rename_branch "$PROJECT_ID" "$API_KEY" "$branch_id" "$new_name"
#   neon_set_branch_expiry "$PROJECT_ID" "$API_KEY" "$branch_id" "$expires_at"
#   neon_delete_branch "$PROJECT_ID" "$API_KEY" "$branch_id"
#
# Shellchecked by CI's workflow-lint job and lefthook's pre-commit hook, which
# walk `scripts/**/*.sh` (issue #61).

# Named so a future host change is one edit, and prefixed so a sourced module
# cannot collide with a caller's variables.
NEON_PREVIEW_API_BASE="https://console.neon.tech/api/v2"

# Every branch of the project that belongs to the PR — the fallback name exactly,
# or anything under the prefix — as `<id>\t<name>` lines.
#
# Paginates on the response cursor: a project can hold thousands of branches, so
# a match on a later page would otherwise be missed, and a missed branch means a
# duplicate is created or one leaks past Cleanup. `search` narrows the list
# server-side (it matches a partial name or id), and the match itself is decided
# by `preview_name_matches`, so `production` and other `pr`-containing names
# cannot slip through.
neon_matching_branches() {
  local project_id=$1
  local api_key=$2
  local pr_number=$3
  local cursor=""
  local url
  local response status body page_next id name
  local matches=""

  while :; do
    url="$NEON_PREVIEW_API_BASE/projects/$project_id/branches?limit=100&search=pr"
    if [ -n "$cursor" ]; then
      url="$url&cursor=$cursor"
    fi

    # `-sS` without `-f`: a non-2xx must stay inspectable so Neon's own message
    # is printed rather than collapsing to a bare `curl: (22)`.
    if ! response=$(curl -sS -w '\n%{http_code}' \
      -H "Authorization: Bearer $api_key" \
      "$url"); then
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

    while IFS=$'\t' read -r id name; do
      [ -n "$id" ] || continue
      if preview_name_matches "$pr_number" "$name"; then
        matches+="${id}"$'\t'"${name}"$'\n'
      fi
    done <<< "$(printf '%s' "$body" | jq -r '.branches[]? | "\(.id)\t\(.name)"')"

    page_next=$(printf '%s' "$body" | jq -r '.pagination.next // empty')
    if [ -z "$page_next" ]; then
      break
    fi
    cursor=$page_next
  done

  if [ -n "$matches" ]; then
    printf '%s' "$matches"
  fi
}

# PATCH one branch with a `branch` object body — the one place the PATCH and
# its status handling live, so the rename and the expiry cannot drift apart.
# Prints nothing on success; a failure names the branch id on stderr.
neon_patch_branch() {
  local project_id=$1
  local api_key=$2
  local branch_id=$3
  local payload=$4
  local response status body

  if ! response=$(curl -sS -w '\n%{http_code}' -X PATCH \
    -H "Authorization: Bearer $api_key" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$NEON_PREVIEW_API_BASE/projects/$project_id/branches/$branch_id"); then
    echo "Could not reach the Neon API to update branch $branch_id." >&2
    return 1
  fi

  status=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')

  case "$status" in
  2??)
    return 0
    ;;
  *)
    echo "Updating Neon branch $branch_id failed (HTTP $status): $body" >&2
    return 1
    ;;
  esac
}

# One branch's name, by id. The renewal step reads the id the create action
# returned and checks its name before PATCHing an expiry onto it, so a
# protected, default or parent branch — `production` is both the parent and the
# project default — is never a target. Prints the name on success.
neon_branch_name() {
  local project_id=$1
  local api_key=$2
  local branch_id=$3
  local response status body name

  if ! response=$(curl -sS -w '\n%{http_code}' \
    -H "Authorization: Bearer $api_key" \
    "$NEON_PREVIEW_API_BASE/projects/$project_id/branches/$branch_id"); then
    echo "Could not reach the Neon API to read branch $branch_id." >&2
    return 1
  fi

  status=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d')

  case "$status" in
  2??) ;;
  *)
    echo "Reading Neon branch $branch_id failed (HTTP $status): $body" >&2
    return 1
    ;;
  esac

  if ! name=$(printf '%s' "$body" | jq -er '.branch.name | strings'); then
    echo "Could not read a name from the Neon branch $branch_id response." >&2
    return 1
  fi

  printf '%s\n' "$name"
}

# Rename one branch. The API takes a PATCH of the name alone.
neon_rename_branch() {
  local project_id=$1
  local api_key=$2
  local branch_id=$3
  local new_name=$4

  neon_patch_branch "$project_id" "$api_key" "$branch_id" \
    "$(jq -n --arg name "$new_name" '{branch: {name: $name}}')" || return 1

  echo "Renamed Neon branch $branch_id to '$new_name'."
}

# Set (or renew) one branch's expiry. The API takes a PATCH of `expires_at`
# alone, an RFC 3339 timestamp at most 30 days from now; the create action
# honours its `expires_at` input only on the path that creates a branch, so a
# reused branch needs this PATCH to keep the cleanup safety net (issue #150).
# Neon refuses to expire protected, default and parent branches, which is why
# callers only ever hand this function a PR's own branch.
neon_set_branch_expiry() {
  local project_id=$1
  local api_key=$2
  local branch_id=$3
  local expires_at=$4

  neon_patch_branch "$project_id" "$api_key" "$branch_id" \
    "$(jq -n --arg expires_at "$expires_at" '{branch: {expires_at: $expires_at}}')" || return 1

  echo "Renewed Neon branch $branch_id expiry to $expires_at."
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
