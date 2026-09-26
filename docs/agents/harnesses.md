# Agent harnesses: instructions and skills

T3 Code drives four providers, each through its own harness. Routing a ticket to a harness only works if that harness loads this repo's instructions (`AGENTS.md`) and — for the skill-driven flows (`/implement`, `/tdd`, `/code-review`, `/grill-with-docs`, …) — the mattpocock skills.

Checked 2026-09-27 on the maintainer's machine. Skills are installed per machine, not in the repo, so re-check after setting up a new machine or upgrading a harness.

| Provider | Harness                              | Loads `AGENTS.md`                                                                                                                                  | mattpocock skills                                                                                                                                                             |
| -------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude   | Claude Code 2.1.283                  | Yes — verified by run (no `CLAUDE.md` needed)                                                                                                      | Yes — `mattpocock-skills` plugin                                                                                                                                              |
| Codex    | codex-cli 0.157.1                    | Yes — verified by run                                                                                                                              | Yes — `mattpocock-skills@mattpocock` plugin in `~/.codex/config.toml`. `/implement` sets `disable-model-invocation`, so invoke it by name; the model won't list it on its own |
| OpenCode | opencode 1.18.32                     | Yes — verified by run                                                                                                                              | Yes — OpenCode also discovers Claude Code's plugin skills (`opencode debug skill` lists them from `~/.claude/plugins/cache/…`)                                                |
| Gemini   | Antigravity (T3's `antigravity-acp`) | Yes, per its bundled docs: it walks up from the working directory loading `GEMINI.md` / `AGENTS.md`. Not run-tested — no Antigravity CLI on `PATH` | **No.** It reads skills from `<workspace>/.agents/skills/` and `~/.gemini/config/skills/`; neither has them                                                                   |

**How "verified by run" was checked:** each harness was asked, from the repo root with no tool use, which repo the `AGENTS.md` "Legacy reference" section names. All three answered `ubeann/vmb-warehouse`.

**OpenCode Go quota:** when the Go usage limit is exhausted, `opencode run` retries silently instead of failing — it looks like a hang. `opencode run --print-logs` shows `Go usage limit exceeded`.

## Routing constraint

Route skill-driven work (`/implement`, `/tdd`, `/code-review`, and the grilling/spec/ticket flows) only to a harness whose row above says **Yes** for skills. Today that excludes Gemini/Antigravity. Gemini can still do work that needs no skills, such as a free-form second-opinion review.

To lift the constraint, link the mattpocock skill directories into `~/.gemini/config/skills/`, then update this table.
