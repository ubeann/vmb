# Agent harnesses: instructions and skills

T3 Code drives one provider, Claude, through Claude Code, on two profiles. Routing a ticket to a harness only works if that harness loads this repo's instructions (`AGENTS.md`) and — for the skill-driven flows (`/implement`, `/tdd`, `/code-review`, `/grill-with-docs`, …) — the mattpocock skills.

Checked 2026-10-06 on the maintainer's machine, against mattpocock-skills 1.3.1. Skills are installed per machine, not in the repo, so re-check after setting up a new machine or upgrading a harness.

| Provider | Harness                                                | Loads `AGENTS.md`                             | mattpocock skills                                                                                                                                         |
| -------- | ------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude   | Claude Code 2.1.296 (Fable 5.1 needs 2.1.255 or later) | Yes — verified by run (no `CLAUDE.md` needed) | Yes — `mattpocock-skills@mattpocock` plugin, from Matt's own marketplace (`mattpocock/skills`, auto-update on). The official marketplace still pins 1.2.3 |

**Gemini (Antigravity) is not routed since 2026-10-18.** It was the second-opinion reviewer on `complex` tickets; `model-routing.md`, Review, says what replaced it and why. Its row (Antigravity through T3's `antigravity-acp`; `AGENTS.md` not loaded at session start, verified by run; skills as copies in `~/.gemini/config/skills/` written by `~/.local/bin/sync-mattpocock-gemini-skills`, because T3 gives Antigravity its own config home whose `skills/` symlink only reads real directories) is dropped rather than kept stale. Disable the Antigravity instance in T3 Code settings. The copy scripts `~/.local/bin/sync-mattpocock-gemini-skills` and the Antigravity half of `~/.local/bin/sync-impeccable-skills` have nothing left to serve and can go; re-verify from scratch if Gemini comes back.

**Codex and OpenCode are not routed since 2026-10-14.** The owner stopped using both. Codex is already disabled in T3 Code settings, so `orchestrator_capabilities` lists it with no models and `canRunChildTask: false`; disable the OpenCode instance the same way so a dispatcher cannot pick it. Their rows (codex-cli 0.160.1 and opencode 2.0.23, `AGENTS.md` and skills verified on 2026-10-06 for both) are dropped rather than kept stale; re-verify from scratch if either comes back. The OpenCode skill-sync plugin under `~/.config/opencode/plugins/` can stay or go; nothing here depends on it.

**How "verified by run" was checked:** each harness was asked, from the repo root with no tool use, which repo the `AGENTS.md` "Legacy reference" section names. Skills were checked by asking each harness to load `domain-modeling` through its skill mechanism and quote the glossary file name (`GLOSSARY.md` in 1.3).

**User-invoked skills are hidden from the model.** `implement`, `implement-spec`, `retro`, `grill-with-docs`, `to-spec`, `to-tickets`, `triage` and the other `disable-model-invocation` skills don't appear in a harness's skill list. Invoke them by name; the model won't pick them up on its own.

**Claude Code shells use the agents' GitHub account.** Claude Code sets `CLAUDECODE=1` in every shell it runs, and `~/.zshenv` on the maintainer's machine switches such shells to `GH_CONFIG_DIR=~/.config/gh-agent`, where `gh` is logged in as `vmb-agent`, and routes git's `github.com` credentials through `gh auth git-credential` for that shell only (`GIT_CONFIG_COUNT` variables). The owner's own shells keep `ubeann` and the macOS keychain. Set up on 2026-10-12; re-create it on a new machine with `GH_CONFIG_DIR=~/.config/gh-agent gh auth login --web --scopes repo,workflow` from a browser signed in as the bot.

**Claude Code under T3 uses a second profile.** T3 runs Claude Code with `CLAUDE_CONFIG_DIR=~/.claude-sharing`, which has its own plugins, separate from `~/.claude`. The Claude row holds only while both profiles have the same plugins, so install or remove a plugin once per profile (`CLAUDE_CONFIG_DIR=~/.claude-sharing claude plugin install …`). They were mirrored on 2026-10-06; before that, T3's Claude threads had no mattpocock skills.

**Impeccable** (design skill, see `design-workflow.md`) is installed along the same path: a Claude Code plugin from `pbakaus/impeccable` with auto-update, once per profile. The copies `~/.local/bin/sync-impeccable-skills` wrote for Antigravity and Codex are unused since both left the routing.

## Routing constraint

Route skill-driven work (`/implement`, `/tdd`, `/code-review`, and the grilling/spec/ticket flows) only to a harness whose row above says **Yes** for skills: Claude Code, on either profile. A `delegate_task` to the other Claude account lands on the same harness with the same plugins, which is what lets the fresh-context review in `model-routing.md` run the `code-review` skill and `/security-review` proper.
