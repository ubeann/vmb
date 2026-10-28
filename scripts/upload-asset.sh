#!/usr/bin/env bash
#
# Retired (ADR-0060). This script committed one file at a time to the private
# `ubeann/vmb-assets` repo through the Contents API: 263 commits by
# `vmb-agent` between 12 and 18 October 2026, 59 of them in one hour, before
# GitHub's abuse detection suspended the account (ADR-0059). Images now go on
# the issue or PR itself with gh's `--attach`, all of a round's files in one
# command; see `docs/agents/issue-tracker.md`, Images. It stays as a stub so
# an old instruction fails loudly instead of committing.

echo "upload-asset.sh is retired (ADR-0060): attach images with gh's --attach, one command for all of them. See docs/agents/issue-tracker.md, Images." >&2
exit 1
