# Coding standards: the reviewer's brief

What a reviewer of this repo checks, where each rule lives, and how to report. The Standards axis of `/code-review` reads this first; so does the fresh-context review and anyone reviewing by hand (`docs/agents/model-routing.md`, Review). It is pointers plus the judgement calls that recurred in the 75 agent reviews of 10–17 October 2026, not a style guide: prettier, eslint, svelte-check, knip, shellcheck, actionlint and the commit-msg hook enforce what a tool can, and a rule that a tool could check moves into the tool and leaves this file.

## What a failure looks like here

Merging to `master` deploys to production. In order of cost:

- A migration, Drizzle schema change, workflow, `fnox.toml` or `wrangler.toml` edit that merges as a two-way door. `scripts/merge-gate.sh` lists these one-way paths; a reviewer confirms the PR's `**Door:**` line matches.
- An `/api/master/*` route without `requirePermission`, a permission check that compares names instead of grants, or a Super Admin bypass (ADR-0045).
- A write to a Trashed record, or a delete that is anything but `deleted_at` (ADR-0055).
- An error reply that is not `{ code, message, issues? }`, or a new code outside the closed list in `@vmb/types` (ADR-0048).
- A form that stops working without JavaScript: Master screens render from server loads and submit through form actions (ADR-0031). PR #448's second round shipped this regression; the review caught it.
- A colour outside the tokens, text under 4.5:1, an icon-only control with no accessible name, a touch target under 44px (ADR-0035 rules 1 and 6).
- A document that now says the opposite of the code: an ADR body, a code comment, the parity sheet, the PR body. Thirty-two reviews in one week found one.

## Sources by area

| Area                       | Where the rules live                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commits, branches, PR body | `docs/agents/git-workflow.md`: Conventional Commits, imperative subject with no `(#n)`, bullet body of _what_, both `Co-Authored-By` lines; `Closes #n`, Acceptance criteria, Door |
| API                        | ADR-0048 errors, ADR-0045 permissions, ADR-0034 sessions and the status gate, ADR-0042 rate limits, ADR-0041 passwords, ADR-0049 transactions, ADR-0017 email sends                |
| Database and migration     | ADR-0055 soft delete, ADR-0032 the domain user record, ADR-0056 legacy RBAC import; `docs/migration/` for the import pipeline                                                      |
| Web data flow and forms    | ADR-0031 server loads and form actions; ADR-0035 rule 4 forms (visible label, errors under the field, one primary action); `packages/types` Zod schemas shared with the API        |
| Design system              | ADR-0035 tokens, registry, icons, tables, accessibility, dark mode, and its amendments on control skin and heights; ADR-0036 palette; ADR-0046 type; ADR-0040 motion               |
| Signed-in screens          | ADR-0050 page layout, ADR-0051 list kit, ADR-0052 keyboard shortcuts, ADR-0053 layered controls; the parity sheet `docs/design/list-kit/parity.md` the tickets quote               |
| Client hardening           | ADR-0047: the CSP and security headers; `apps/web/csp.ts` and `hooks.server.ts`                                                                                                    |
| CI, tooling, scripts       | ADR-0010 mise, ADR-0037 knip, ADR-0043 per-job billing, ADR-0054 the `master` ruleset; every `scripts/*.sh` header states its rules and names its test                             |
| Agent docs                 | `docs/agents/*.md`: pointers over prose, no sentence that goes stale when the code moves, dates on claims that will                                                                |
| Domain terms               | `GLOSSARY.md` when it exists, else the ADR that names the term (`docs/agents/domain.md`)                                                                                           |

An ADR is amended, never silently contradicted: a dated `**Amendment (date, #n)**` paragraph at its end, as the existing ones do.

## Judgement calls that recur

Each is a labelled heuristic, cited with the hunk, never a hard violation. The count is how often it came up in the 75 reviews.

1. **Duplicated Code (42).** The same class string, selector or hunk in three places: the kit skin written out in `input.svelte`, `select-trigger.svelte` and a button; the write-then-requery 404/409 tail in three stores; `type Fields = X & { updatedAt? }` in three forms. When a hunk appears twice in one diff, name it once.
2. **Stale prose (32).** An ADR body the amendment contradicts, a comment that describes the old call, a parity-sheet row citing a rule that does not exist. Cite the line; the fix is the amendment or the rewrite, in the same PR.
3. **Commit shape (30).** A `docs:` commit carrying a behaviour change, a noun-phrase subject, a `why` paragraph in the commit instead of the PR, a missing `vmb-agent` trailer. One concern per commit; unrelated hunks split.
4. **Accessible names (27).** The name goes on the control, not on the `<svg>` inside it; `aria-pressed` only on a toggle, `aria-current` for position; no `<section aria-label>` around a single button; icons `aria-hidden`.
5. **Data Clumps and Primitive Obsession (21).** Two props spelling one thing (`countNoun` beside `noun`); `edit?: boolean` plus `run?: () => void` as a hidden either/or that wants a discriminated union; a boolean flag parameter. A validated string (`tz`, a calendar day) at a Zod edge is accepted as is.
6. **Parity deviations (Spec axis).** A deliberate departure from the parity sheet or the ticket gets a line in Evidence and, when it changes a rule, an ADR amendment. Unrecorded, it reads as a miss.
7. **Comment blocks re-wrapped.** Editing a wrapped comment paragraph leaves an orphan short line unless the paragraph is re-wrapped; prettier does not do it.
8. **Speculative Generality.** An export only a test calls, a parameter no caller passes. Inline until a second caller exists.

## What to skip

- Anything a tool enforces: formatting, import order, unused exports, type errors, shell lint, the commit subject's shape.
- `apps/web/src/lib/components/ui/**`: vendored from the shadcn-svelte registry (ADR-0035 rule 2). Report only that it was edited, since system-wide changes belong in `app.css` or the eslint config.
- `migrations/**`: generated by drizzle-kit. Review the schema change and the Door, not the SQL text.
- `docs/design/*/captures/`, `docs/design/*/sources/`, `.impeccable/`, `pnpm-lock.yaml`.
- Lines the PR did not change. A pre-existing problem is named as pre-existing and not counted.

## How to report

- Count first: `N hard violations, M judgement calls, K nits`.
- Each finding: file and line, the source (`ADR-0048`, or `git-workflow.md`, Commit messages), what fails, the fix. Hard violation or judgement call, labelled.
- Nits last, three at most, grouped: a nit is anything the user would never notice.
- Under 400 words per axis, which is the skill's cap. Nothing you did not run is reported as run.

## Keeping this file honest

A judgement call that recurs three times with no source gets a line here or an ADR; a rule a tool could check becomes an eslint rule, a test or a script and leaves this file. `/retro` re-reads the review results and prunes the list.
