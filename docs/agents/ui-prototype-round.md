# UI prototype round: from critique to tickets

How to decide a screen's layout and interaction before anything is built: the list kit's toolbar, filters, rows and paging, or a record modal. A screen's art and motion are a different round, `design-workflow.md`. Proven on the list kit (critique of #340, ADR-0051 to ADR-0053, tickets #360 to #368, prototype branch `t3/improve-table-filter-header-ui`, final variant `C3kd2`). The two rules that cost the most there, the stop rule and the parity sheet, come from how that round ended: eleven differences between `master` and the prototype after every ticket had merged, and five owner review rounds on one PR for calls the prototype had already made.

A prototype is **evidence**. The ADRs and the parity sheet are the spec; a ticket quotes them, never the prototype.

## Steps

1. **Critique and grill**, at the planning tier (`model-routing.md`). Capture the screen as it is (`page-checks.md`), critique it, then grill: every question carries options and a recommendation, and the owner may answer "prototype" to defer it. File the backend tickets the moment the grilling settles a data contract (the API filters ticket #361 had no visual dependency and could have run on the night loop while variants were still being picked). _Done when_ every question has an answer or is marked prototype.
2. **Prototype the deferred questions only.** Follow `/prototype`'s UI branch: a throwaway route under `src/routes/prototype/<kit>/`, one file per variant, fixture data, switched by `?variant=`, with the sign-in gate bypassed in dev only, on a branch that never merges. Each owner pick goes in the commit message that records it. Stop at the first round that would change a colour, a radius, a width or a line of copy on fixture data: that is polish, and polish happens on the real page (`/impeccable live` or the PR preview). The list kit spent about forty of its ninety-seven rounds on polish and rebuilt every one of those on real components; its single 2,888-line variant file was re-read every round. _Done when_ every deferred question has a picked variant.
3. **Record the decisions as ADRs** on a docs branch from `master` (the prototype branch carries no docs). A palette or token change amends ADR-0035 or ADR-0036. _Done when_ the ADR PR has merged.
4. **Write the parity sheet**, `docs/design/<round>/parity.md`, one row per component of the final variant: the exact value (size, token, class, copy, behaviour), the prototype file and line, and the round that chose it. A deliberate deviation decided later is recorded here, next to the ADR that explains it. _Done when_ every component on the final variant has a row.
5. **File the tickets** with `/to-tickets`. Each acceptance criterion quotes the parity rows it covers, and the ticket carries the copy-pasteable form of its reference, `git show origin/<branch>:<path>`, since a path assembled from prose was mangled twice in #368. The last ticket of the milestone is the **parity audit**: compare `master` with the sheet, fix each miss or record it as a deviation. _Done when_ ticket-lint passes on every ticket and the audit ticket exists.
6. **Build through the ticket loop.** An owner review that makes a design call during a build updates the parity sheet or the ADR in the same PR, so the next ticket inherits it. _Done when_ the parity audit ticket closes.

## Tried and dropped

| Approach                                   | Why it was dropped                                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Match `C3kd2`" as an acceptance criterion | Eleven differences after nine merged tickets; the reviewer could not tell a miss from a deliberate change. Criteria quote values, not a variant name. |
| Polish rounds on fixture data              | Search box colour, button min-width and calendar widths were decided on fixtures, then decided again on real components.                              |
| One file for every variant                 | The file reached 2,888 lines and was the bulk of the round's context spend. One file per variant keeps a round's reads small.                         |
| Prototype line numbers as the pointer      | They drift with every commit. The parity sheet pins a value; the `git show` line pins the file.                                                       |
