#!/usr/bin/env bash
#
# Create or update the branch ruleset that protects the default branch. Merging
# to `master` deploys to production (`ci.yml`'s Release job), so GitHub itself
# refuses what must never land there: a force-push, a deletion, a push that
# skips a pull request, and a merge while `Verify` is red (the real-server
# database suite is a step inside it, ADR-0043).
# `scripts/merge-gate.sh` stays the second layer and the only thing that decides
# what an agent may merge. The reasoning is in ADR-0054.
#
# The ruleset is named `master`. The script finds it by that name, so running it
# twice updates the one ruleset instead of adding another. `bypass_actors` is
# empty on purpose: the owner's token, which the agents also use, is held to the
# same rules.
#
# Usage:
#   scripts/master-ruleset.sh --print   write the payload to stdout, call nothing
#   scripts/master-ruleset.sh           create or update the ruleset with `gh api`
#                                       (needs admin on the repository)
# Tests: `bash scripts/master-ruleset.test.sh`.

set -euo pipefail

NAME=master

# The GitHub Actions app: a check is pinned to it, so another app cannot report
# a status called `Verify` and satisfy the rule.
ACTIONS_APP_ID=15368

usage() {
  echo "usage: master-ruleset.sh [--print]" >&2
  exit 2
}

payload() {
  jq -n --arg name "$NAME" --argjson app "$ACTIONS_APP_ID" '{
    name: $name,
    target: "branch",
    enforcement: "active",
    conditions: {ref_name: {include: ["~DEFAULT_BRANCH"], exclude: []}},
    bypass_actors: [],
    rules: [
      {type: "deletion"},
      {type: "non_fast_forward"},
      {type: "pull_request", parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
        allowed_merge_methods: ["squash", "merge"]
      }},
      {type: "required_status_checks", parameters: {
        strict_required_status_checks_policy: false,
        do_not_enforce_on_create: false,
        required_status_checks: [
          {context: "Verify", integration_id: $app}
        ]
      }}
    ]
  }'
}

[ $# -le 1 ] || usage
case "${1:-}" in
  "") ;;
  --print)
    payload
    exit 0
    ;;
  *) usage ;;
esac

# `--paginate` prints one JSON array a page, so slurp them before looking.
id=$(gh api --paginate "repos/{owner}/{repo}/rulesets?includes_parents=false" |
  jq -rs --arg name "$NAME" '[.[][] | select(.name == $name) | .id] | first // empty')

if [ -n "$id" ]; then
  payload | gh api --method PUT "repos/{owner}/{repo}/rulesets/$id" --input - >/dev/null
  echo "Updated ruleset \`$NAME\` (id $id)."
else
  payload | gh api --method POST "repos/{owner}/{repo}/rulesets" --input - >/dev/null
  echo "Created ruleset \`$NAME\`."
fi
