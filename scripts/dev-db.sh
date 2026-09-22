#!/usr/bin/env bash
#
# The local development database: a per-developer Neon branch (ADR-0029).
#
# There is no standing dev branch (ADR-0028). Instead each developer gets
# their own throwaway branch forked from `production`, migrated and seeded —
# the same shape a preview has (ADR-0019), so it holds deterministic fixtures
# rather than production rows once `up` finishes.
#
#   scripts/dev-db.sh up [--reset]   create (or reuse) your branch, migrate and
#                                    seed it, and point the local DATABASE_URL
#                                    at it
#   scripts/dev-db.sh down           delete your branch and drop the local URL
#   scripts/dev-db.sh status         report your branch and the local URL
#   scripts/dev-db.sh list           list every per-developer branch
#
# Your branch is `dev-<slug>`, where the slug comes from DEV_DB_SLUG, or the
# local part of your git email, or $USER. It is forked from `production`, and it
# expires after DEV_DB_EXPIRES_DAYS — default 30, Neon's maximum; 0 for no
# expiry, and a larger value is clamped. The TTL is a safety net for a branch
# nobody tears down: every `up` pushes the expiry out, so it cannot lapse under
# a developer who is using it, and `up` also detects an expired or deleted
# branch and recreates it.
#
# The connection string never touches the committed fnox store: it is written
# to the gitignored `fnox.local.toml` overlay, which fnox merges over
# `fnox.toml`. That keeps a per-developer value out of a shared file and keeps
# `DATABASE_URL` off `production` (the hazard this script exists to remove).
#
# Requires NEON_API_KEY and NEON_PROJECT_ID. Put them in `fnox.local.toml` too
# and run through fnox so they are in the environment:
#
#   [providers.plain]
#   type = "plain"
#
#   [secrets]
#   NEON_API_KEY = { provider = "plain", value = "napi_..." }
#   NEON_PROJECT_ID = { provider = "plain", value = "..." }
#
#   fnox exec scripts/dev-db.sh up
#
# A project-scoped API key from the Neon console is enough. The `plain`
# provider is right for a gitignored file: these are local, unshared values.

set -euo pipefail

API_BASE="https://console.neon.tech/api/v2"
DATABASE_NAME="app"
PARENT_BRANCH="production"
DEV_BRANCH_PREFIX="dev-"
# Neon rejects an expiry more than 30 days out, and that is the ceiling the API
# documents: "Maximum expiration is 30 days from the current time".
DEV_DB_EXPIRES_MAX_DAYS=30

usage() {
  sed -n '2,42p' "$0" | sed 's/^# \{0,1\}//'
}

log() { printf '  %s\n' "$1"; }
fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not on PATH"
}

# Calls the API and prints the response body. `curl -f` is deliberately not
# used: it throws away the response, and Neon's error message is the only thing
# that explains a 400 — a missing field, a branch limit, an unsupported value.
api() {
  local method=$1 path=$2 body=${3:-} response status message

  if [ -n "$body" ]; then
    response=$(curl -sS -X "$method" \
      -H "Authorization: Bearer $NEON_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$body" \
      -w $'\n%{http_code}' \
      "$API_BASE$path" 2>&1) || fail "Neon API $method $path: curl failed — $response"
  else
    response=$(curl -sS -X "$method" \
      -H "Authorization: Bearer $NEON_API_KEY" \
      -w $'\n%{http_code}' \
      "$API_BASE$path" 2>&1) || fail "Neon API $method $path: curl failed — $response"
  fi

  status=${response##*$'\n'}
  response=${response%$'\n'*}

  case "$status" in
  [0-9][0-9][0-9]) ;;
  *) fail "Neon API $method $path: no HTTP status in the response ($response)" ;;
  esac

  if [ "$status" -ge 400 ]; then
    message=$(printf '%s' "$response" | jq -r '.message // empty' 2>/dev/null || true)
    [ -n "$message" ] || message=$response
    fail "Neon API $method $path returned $status: $message"
  fi

  printf '%s' "$response"
}

# The branch's id, or empty when it does not exist. `search` narrows
# server-side because list-branches is cursor-paginated; `limit` is well past
# any project's branch limit, so the match cannot hide on a second page
# (the same lookup cleanup.yml uses).
branch_id_of() {
  api GET "/projects/$NEON_PROJECT_ID/branches?limit=100&search=$1" \
    | jq -r --arg name "$1" '[.branches[] | select(.name == $name) | .id] | first // ""'
}

dev_slug() {
  local source=${DEV_DB_SLUG:-}
  if [ -z "$source" ]; then
    source=$(git config user.email 2>/dev/null || true)
    source=${source%%@*}
  fi
  [ -n "$source" ] || source=${USER:-developer}

  # The same recipe as `preview_slug` in `preview-identifiers.sh` (a branch
  # name and a DNS label are both lowercase-dash words), but a Neon branch name
  # has a 256-character budget rather than a 63-character label, so the cap is
  # about readability here, not DNS.
  printf '%s' "$source" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-24 \
    | sed -E 's/-+$//'
}

expiry_iso() {
  local days=$1
  if date -u -d "+$days days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null; then return; fi
  date -u -v+"${days}"d +%Y-%m-%dT%H:%M:%SZ
}

# The requested TTL, validated and clamped to the API's ceiling. A larger value
# is clamped rather than rejected: `up` refreshes the TTL on every run, so the
# cap never leaves a branch in use without one, and failing the run over an
# over-long env var helps nobody.
expiry_days() {
  local days=${DEV_DB_EXPIRES_DAYS:-$DEV_DB_EXPIRES_MAX_DAYS}

  case "$days" in
  '' | *[!0-9]*) fail "DEV_DB_EXPIRES_DAYS must be a whole number of days (0 for no expiry)" ;;
  esac

  if [ "$days" -gt "$DEV_DB_EXPIRES_MAX_DAYS" ]; then
    log "DEV_DB_EXPIRES_DAYS=$days is past Neon's ${DEV_DB_EXPIRES_MAX_DAYS}-day maximum; using ${DEV_DB_EXPIRES_MAX_DAYS}."
    days=$DEV_DB_EXPIRES_MAX_DAYS
  fi

  printf '%s' "$days"
}

# The TTL is a safety net for a branch nobody uses, not a deadline on one in
# daily use, so every `up` pushes it out. Zero means no expiry at all, and on a
# branch that already has one that is an explicit removal (the API takes null).
refresh_expiry() {
  local branch_id=$1 days expires body

  days=$(expiry_days)
  if [ "$days" -le 0 ]; then
    api PATCH "/projects/$NEON_PROJECT_ID/branches/$branch_id" \
      '{"branch": {"expires_at": null}}' >/dev/null
    log "Expiry removed (DEV_DB_EXPIRES_DAYS=0)."
    return 0
  fi

  expires=$(expiry_iso "$days")
  body=$(jq -n --arg expires "$expires" '{branch: {expires_at: $expires}}')
  api PATCH "/projects/$NEON_PROJECT_ID/branches/$branch_id" "$body" >/dev/null
  log "Expiry refreshed to $expires."
}

overlay_has_plain_provider() {
  grep -q '^\[providers\.plain\]' fnox.local.toml 2>/dev/null
}

write_local_url() {
  local url=$1

  if ! overlay_has_plain_provider; then
    fnox -c fnox.local.toml provider add plain plain >/dev/null
  fi
  fnox -c fnox.local.toml set DATABASE_URL "$url" --provider plain >/dev/null

  if [ "$(fnox get DATABASE_URL 2>/dev/null || true)" != "$url" ]; then
    fail "wrote DATABASE_URL to fnox.local.toml but fnox does not resolve it"
  fi
}

forget_local_url() {
  if [ -f fnox.local.toml ]; then
    fnox -c fnox.local.toml remove DATABASE_URL >/dev/null 2>&1 || true
  fi
}

wait_until_ready() {
  local branch_id=$1 endpoint_id=$2 state endpoint_state attempt

  for attempt in $(seq 1 40); do
    state=$(api GET "/projects/$NEON_PROJECT_ID/branches/$branch_id" | jq -r '.branch.current_state')
    endpoint_state=$(api GET "/projects/$NEON_PROJECT_ID/endpoints/$endpoint_id" | jq -r '.endpoint.current_state')
    if [ "$state" = "ready" ] && [ "$endpoint_state" != "init" ]; then
      return 0
    fi
    sleep 3
  done

  fail "branch did not become ready after $attempt checks (branch: $state, endpoint: $endpoint_state)"
}

# Prints the branch's application-database connection string. The role is the
# database's owner and its password is URL-encoded with jq, so a password
# containing `@`, `/` or `:` cannot break the URI.
connection_url() {
  local branch_id=$1 host=$2 owner password encoded role

  owner=$(api GET "/projects/$NEON_PROJECT_ID/branches/$branch_id/databases" \
    | jq -r --arg db "$DATABASE_NAME" '[.databases[] | select(.name == $db) | .owner_name] | first // ""')
  if [ -z "$owner" ]; then
    fail "branch has no database named '$DATABASE_NAME' — if it predates the rename, re-run with: scripts/dev-db.sh up --reset"
  fi

  # The roles *list* does not carry passwords, so this reads the dedicated
  # reveal endpoint — the same call `neondatabase/create-branch-action` makes on
  # every run, and it reveals rather than rotates the password.
  role=$(printf '%s' "$owner" | jq -Rr @uri)
  password=$(api GET "/projects/$NEON_PROJECT_ID/branches/$branch_id/roles/$role/reveal_password" \
    | jq -r '.password // ""')
  if [ -z "$password" ]; then
    fail "could not read the '$owner' role's password for branch $branch_id"
  fi

  encoded=$(printf '%s' "$password" | jq -Rr @uri)
  printf 'postgresql://%s:%s@%s/%s?sslmode=require&channel_binding=require' \
    "$owner" "$encoded" "$host" "$DATABASE_NAME"
}

create_branch() {
  local name=$1 days expires branch_json body response

  days=$(expiry_days)
  if [ "$days" -gt 0 ]; then
    expires=$(expiry_iso "$days")
    branch_json=$(jq -n --arg name "$name" --arg parent "$PARENT_ID" --arg expires "$expires" \
      '{name: $name, parent_id: $parent, expires_at: $expires}')
  else
    branch_json=$(jq -n --arg name "$name" --arg parent "$PARENT_ID" \
      '{name: $name, parent_id: $parent}')
  fi

  # `suspend_timeout_seconds: 0` (the plan default) matches what the working
  # `neondatabase/create-branch-action` sends for a preview branch; a body
  # without it is a shape the API has not accepted.
  body=$(jq -n --argjson branch "$branch_json" \
    '{branch: $branch, endpoints: [{type: "read_write", suspend_timeout_seconds: 0}]}')

  log "Creating Neon branch '$name' from '$PARENT_BRANCH'…"
  response=$(api POST "/projects/$NEON_PROJECT_ID/branches" "$body")

  BRANCH_ID=$(printf '%s' "$response" | jq -r '.branch.id')
  ENDPOINT_ID=$(printf '%s' "$response" | jq -r '.endpoints[0].id')
  ENDPOINT_HOST=$(printf '%s' "$response" | jq -r '.endpoints[0].host')

  if [ -z "$BRANCH_ID" ] || [ -z "$ENDPOINT_ID" ] || [ -z "$ENDPOINT_HOST" ]; then
    fail "branch creation returned no branch/endpoint: $response"
  fi

  wait_until_ready "$BRANCH_ID" "$ENDPOINT_ID"
}

# Refuses an id that is the parent branch's. A name check would be dead code —
# the dev name always carries DEV_BRANCH_PREFIX — so what actually keeps `down`
# and `up --reset` from deleting `production` is comparing identities.
refuse_parent_branch() {
  local branch_id=$1

  if [ -n "$branch_id" ] && [ "$branch_id" = "$PARENT_ID" ]; then
    fail "refusing to operate on '$PARENT_BRANCH' ($PARENT_ID)"
  fi
}

cmd_up() {
  local reset=${1:-}

  BRANCH_ID=$(branch_id_of "$BRANCH_NAME")
  refuse_parent_branch "$BRANCH_ID"
  if [ -n "$BRANCH_ID" ] && [ "$reset" = "--reset" ]; then
    log "Deleting existing branch '$BRANCH_NAME' ($BRANCH_ID)…"
    api DELETE "/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID" >/dev/null
    BRANCH_ID=""
  fi

  if [ -n "$BRANCH_ID" ]; then
    log "Reusing Neon branch '$BRANCH_NAME' ($BRANCH_ID)."
    ENDPOINT_HOST=$(api GET "/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID/endpoints" \
      | jq -r '[.endpoints[] | select(.type == "read_write") | .host] | first // ""')
    if [ -z "$ENDPOINT_HOST" ] || [ "$ENDPOINT_HOST" = "null" ]; then
      fail "branch '$BRANCH_NAME' has no compute endpoint — re-run with: scripts/dev-db.sh up --reset"
    fi
    refresh_expiry "$BRANCH_ID"
  else
    create_branch "$BRANCH_NAME"
  fi

  URL=$(connection_url "$BRANCH_ID" "$ENDPOINT_HOST")
  write_local_url "$URL"

  log "Migrating…"
  DATABASE_URL="$URL" pnpm --filter @vmb/db db:migrate
  log "Seeding (this wipes the branch's application tables)…"
  DATABASE_URL="$URL" pnpm --filter @vmb/db db:seed

  printf '\n'
  log "Local database ready."
  log "  branch:   $BRANCH_NAME ($BRANCH_ID)"
  log "  database: $DATABASE_NAME"
  log "  url:      ${URL%%:*}://${URL#*@} (credentials in fnox.local.toml)"
  log ""
  log "DATABASE_URL now resolves through fnox for this checkout. Run database"
  log "commands through fnox, e.g. fnox exec pnpm --filter @vmb/db db:seed, and"
  log "apps/api's predev exports it into .dev.vars for wrangler dev."
}

cmd_down() {
  BRANCH_ID=$(branch_id_of "$BRANCH_NAME")
  refuse_parent_branch "$BRANCH_ID"
  if [ -z "$BRANCH_ID" ]; then
    log "No Neon branch named '$BRANCH_NAME'."
  else
    log "Deleting Neon branch '$BRANCH_NAME' ($BRANCH_ID)…"
    api DELETE "/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID" >/dev/null
  fi

  forget_local_url
  log "Removed DATABASE_URL from fnox.local.toml."
}

cmd_status() {
  BRANCH_ID=$(branch_id_of "$BRANCH_NAME")

  if [ -z "$BRANCH_ID" ]; then
    log "branch:  $BRANCH_NAME — not found (run: scripts/dev-db.sh up)"
  else
    local state
    state=$(api GET "/projects/$NEON_PROJECT_ID/branches/$BRANCH_ID" | jq -r '.branch.current_state')
    log "branch:  $BRANCH_NAME ($BRANCH_ID, $state)"
  fi

  local url
  url=$(fnox get DATABASE_URL 2>/dev/null || true)
  if [ -z "$url" ]; then
    log "url:     none in fnox.local.toml (run: scripts/dev-db.sh up)"
  else
    log "url:     postgresql://***@${url#*@}"
  fi
}

cmd_list() {
  api GET "/projects/$NEON_PROJECT_ID/branches?limit=100" \
    | jq -r --arg prefix "$DEV_BRANCH_PREFIX" --arg mine "$BRANCH_NAME" \
      '.branches[] | select(.name | startswith($prefix))
       | "\(if .name == $mine then "*" else " " end) \(.name)\t\(.current_state)"'
}

case "${1:-}" in
"" | -h | --help | help) usage; exit 0 ;;
up)
  case "${2:-}" in
  "" | --reset) ;;
  *)
    fail "unknown option '${2}' — usage: scripts/dev-db.sh up [--reset]"
    ;;
  esac
  ;;
down | status | list) ;;
*)
  usage
  exit 1
  ;;
esac

require curl
require jq
require fnox
require pnpm

[ -n "${NEON_API_KEY:-}" ] || fail "NEON_API_KEY is not set — put it in fnox.local.toml (see the header) and run through fnox"
[ -n "${NEON_PROJECT_ID:-}" ] || fail "NEON_PROJECT_ID is not set — put it in fnox.local.toml (see the header) and run through fnox"

BRANCH_NAME="${DEV_BRANCH_PREFIX}$(dev_slug)"
PARENT_ID=$(branch_id_of "$PARENT_BRANCH")
[ -n "$PARENT_ID" ] || fail "no Neon branch named '$PARENT_BRANCH' in project $NEON_PROJECT_ID"

case "${1:-}" in
up) cmd_up "${2:-}" ;;
down) cmd_down ;;
status) cmd_status ;;
list) cmd_list ;;
esac
