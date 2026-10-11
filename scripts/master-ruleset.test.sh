#!/usr/bin/env bash
#
# Tests for `master-ruleset.sh`, which protects `master` with a GitHub ruleset.
# `--print` is checked against the payload's rules, and the create-then-update
# path runs against a fake `gh` that keeps rulesets in a file, so nothing here
# touches the API.
#
# Run from anywhere: `bash scripts/master-ruleset.test.sh`. CI runs it in the
# `Verify` job, and lefthook runs it on a commit that touches the script or
# this file.

set -euo pipefail

cd "$(dirname "$0")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

failures=0
checks=0

# ok <description> <command...>: passes when the command succeeds.
ok() {
  local description=$1
  shift
  checks=$((checks + 1))
  if "$@" >/dev/null 2>&1; then
    printf 'ok   %s\n' "$description"
  else
    printf 'FAIL %s\n' "$description"
    failures=$((failures + 1))
  fi
}

bash master-ruleset.sh --print >"$tmp/payload.json"

# payload_ok <jq filter>: succeeds when the filter is true for the printed payload.
payload_ok() { jq -e "$1" "$tmp/payload.json"; }

ok "--print emits JSON" jq -e . "$tmp/payload.json"
ok "the ruleset is named master, on branches, and active" \
  payload_ok '.name == "master" and .target == "branch" and .enforcement == "active"'
ok "it targets the default branch" \
  payload_ok '.conditions.ref_name.include == ["~DEFAULT_BRANCH"] and .conditions.ref_name.exclude == []'
ok "nothing bypasses it" payload_ok '.bypass_actors == []'
ok "it has exactly the four rules" \
  payload_ok '[.rules[].type] | sort == ["deletion", "non_fast_forward", "pull_request", "required_status_checks"]'
ok "a pull request needs no approvals and no code owner" \
  payload_ok '.rules[] | select(.type == "pull_request") | .parameters
    | .required_approving_review_count == 0 and .require_code_owner_review == false'
ok "squash and merge are the allowed merge methods" \
  payload_ok '.rules[] | select(.type == "pull_request") | .parameters.allowed_merge_methods == ["squash", "merge"]'
ok "only Verify is required, pinned to the GitHub Actions app" \
  payload_ok '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks
    == [{context: "Verify", integration_id: 15368}]'
ok "strict status checks are off" \
  payload_ok '.rules[] | select(.type == "required_status_checks") | .parameters.strict_required_status_checks_policy == false'
ok "an unknown argument is refused" test "$(bash master-ruleset.sh --bogus >/dev/null 2>&1; echo $?)" = 2

# A fake `gh`: GET lists the stored rulesets, POST adds one with the next id,
# PUT replaces the one with that id. Every call is logged.
mkdir "$tmp/bin"
cat >"$tmp/bin/gh" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
echo "$*" >>"$FAKE_DIR/calls"
store="$FAKE_DIR/rulesets.json"
method=GET
path=
while [ $# -gt 0 ]; do
  case "$1" in
    api | --paginate | --input) [ "$1" = --input ] && shift ;;
    --method) method=$2; shift ;;
    *) path=$1 ;;
  esac
  shift
done
case "$method:$path" in
  GET:*/rulesets\?*) jq -c '.[] | [.]' "$store" ;; # one array a page, as --paginate prints
  POST:*/rulesets)
    jq -s --slurpfile all "$store" '($all[0] | length + 1) as $id | $all[0] + [.[0] + {id: $id}]' >"$store.new"
    mv "$store.new" "$store" ;;
  PUT:*/rulesets/*)
    id=${path##*/}
    jq -s --slurpfile all "$store" --argjson id "$id" \
      '[$all[0][] | select(.id != $id)] + [.[0] + {id: $id}]' >"$store.new"
    mv "$store.new" "$store" ;;
  *) echo "fake gh: unexpected call: $method $path" >&2; exit 1 ;;
esac
FAKE
chmod +x "$tmp/bin/gh"

export FAKE_DIR="$tmp"
echo '[{"id": 1, "name": "other"}]' >"$tmp/rulesets.json"
: >"$tmp/calls"

run() { PATH="$tmp/bin:$PATH" bash master-ruleset.sh; }

ok "the first run creates the ruleset" run
ok "one ruleset named master exists" \
  jq -e '[.[] | select(.name == "master")] | length == 1' "$tmp/rulesets.json"
ok "the second run updates it" run
ok "still exactly one ruleset named master" \
  jq -e '[.[] | select(.name == "master")] | length == 1' "$tmp/rulesets.json"
ok "the unrelated ruleset is left alone" \
  jq -e '[.[] | select(.name == "other")] | length == 1' "$tmp/rulesets.json"
ok "the first run POSTed and the second PUT" \
  test "$(grep -c -- '--method POST' "$tmp/calls") $(grep -c -- '--method PUT' "$tmp/calls")" = "1 1"
# shellcheck disable=SC2016 # `$p` is a jq variable, not a shell one
ok "the stored ruleset is the printed payload" \
  jq -e --slurpfile p "$tmp/payload.json" '.[] | select(.name == "master") | del(.id) == $p[0]' "$tmp/rulesets.json"

printf '\n%d checks, %d failed\n' "$checks" "$failures"
[ "$failures" -eq 0 ]
