# Agent harnesses: instructions and skills

T3 Code drives four providers, each through its own harness. Routing a ticket to a harness only works if that harness loads this repo's instructions (`AGENTS.md`) and — for the skill-driven flows (`/implement`, `/tdd`, `/code-review`, `/grill-with-docs`, …) — the mattpocock skills.

Checked 2026-10-06 on the maintainer's machine, against mattpocock-skills 1.3.1. Skills are installed per machine, not in the repo, so re-check after setting up a new machine or upgrading a harness.

| Provider | Harness                              | Loads `AGENTS.md`                                                                                                                                                 | mattpocock skills                                                                                                                                                       |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude   | Claude Code 2.1.290                  | Yes — verified by run (no `CLAUDE.md` needed)                                                                                                                     | Yes — `mattpocock-skills@mattpocock` plugin, from Matt's own marketplace (`mattpocock/skills`, auto-update on). The official marketplace still pins 1.2.3               |
| Codex    | codex-cli 0.160.1                    | Yes — verified by run                                                                                                                                             | Yes — `mattpocock-skills@mattpocock` plugin in `~/.codex/config.toml`; `codex plugin marketplace upgrade mattpocock` refreshes it                                       |
| OpenCode | opencode 2.0.23                      | Yes — verified by run                                                                                                                                             | Yes — the local `~/.config/opencode/plugins/claude-skills-sync` plugin loads every skill of Claude Code's enabled plugins, so it follows Claude's install               |
| Gemini   | Antigravity (T3's `antigravity-acp`) | Not at session start — verified by run: it answered "not in context". Its docs say it loads `AGENTS.md` as files are opened, so tell it to read `AGENTS.md` first | Yes — copies in `~/.gemini/config/skills/`, written by `~/.local/bin/sync-mattpocock-gemini-skills` from Claude's marketplace checkout. Re-run it after a skills update |

**How "verified by run" was checked:** each harness was asked, from the repo root with no tool use, which repo the `AGENTS.md` "Legacy reference" section names. Skills were checked by asking each harness to load `domain-modeling` through its skill mechanism and quote the glossary file name (`GLOSSARY.md` in 1.3).

**User-invoked skills are hidden from the model.** `implement`, `implement-spec`, `retro`, `grill-with-docs`, `to-spec`, `to-tickets`, `triage` and the other `disable-model-invocation` skills don't appear in a harness's skill list. Invoke them by name; the model won't pick them up on its own.

**Antigravity skill discovery:** T3 runs Antigravity with its own config home (`~/.t3/userdata/providers/antigravity/<hash>/config/`) whose `skills/` is a symlink to `~/.gemini/config/skills/`. Nothing else under `~/.gemini/config/` reaches it, so `skills.json` and `plugins/` are ignored, and a symlinked skill directory is listed but can't be read. Only real skill directories work, hence the copy script.

**OpenCode Go quota:** when the Go usage limit is exhausted, `opencode run` retries silently instead of failing — it looks like a hang. `opencode run --print-logs` shows `Go usage limit exceeded`. A free model (`opencode/big-pickle`) still works for a probe.

## Routing constraint

Route skill-driven work (`/implement`, `/tdd`, `/code-review`, and the grilling/spec/ticket flows) only to a harness whose row above says **Yes** for skills. All four do today. When routing to Gemini, start the task by telling it to read `AGENTS.md`, since it doesn't load it up front. Gemini's copies only change when the sync script runs, so run it before routing skill-driven work there after a mattpocock update.
