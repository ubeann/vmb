# ADR-0028: No standing dev branch; the legacy import is a cutover rehearsal

**Context:** ADR-0024 assumed a standing dev Neon branch as the destination for imported legacy records, and ADR-0019 named that branch as the one `preview.yml` deliberately does not use as a parent. ADR-0027 then found the branch was never provisioned — the project holds `production` and per-PR preview branches only — and recorded the state rather than resolving the mismatch (issue #133). Meanwhile the preview data policy settled: a preview forks `production` and `db:seed` replaces every row with deterministic fixtures (ADR-0019, issues #118 and #120). Issue #18 built and tested the import pipeline — extraction runbook, load, repeatability — but its remaining step still assumed a dev branch to load into.

**Options considered:**

- **Keep a standing dev branch.** Real legacy rows on tap for development and parity checks, and a place for the import to land before cutover. Rejected: it is a second branch to keep at production's head — the exact drift ADR-0019 rejected it for as a preview parent — and the day-to-day need it served (a data shape to build against) is what `db:seed` now covers.
- **No dev branch; the import runs against a throwaway branch and the report outlives it.** The pipeline stays the rehearsed cutover path (ADR-0024); the branch is a means to the verifier report, created for the run and deleted after.
- **No dev branch and no rehearsal.** Rely on cutover day to discover whether real records replay cleanly. Rejected: the report — `errors: 0, warnings: 0`, per-table row counts, business-key checksums, FK-integrity count — is the only evidence that the chain survives real data, and #17 depends on that evidence existing.

**Decision:** No standing dev branch.

- The Neon project holds `production` and per-PR preview branches (ADR-0019). Development data — for previews and locally — comes from `db:seed`, whose fixtures grow as modules land.
- The import pipeline remains the cutover mechanism (ADR-0024). Its rehearsal target is a throwaway branch: create it, `pnpm --filter @vmb/db db:import --snapshot snapshot.sql --url "$DATABASE_URL"`, record the report, delete the branch. The report is the deliverable; the branch is disposable.
- #18 is rescoped to that rehearsal — no dev-branch acceptance criterion — and its blocking edge over #6 is dropped: CRUD development runs against seeded data, so it does not wait on legacy records. At cutover, #17 points the same pipeline at the real target.
- `db:import` and `db:seed` each own the database they run against (both wipe it) and cannot share a branch; preview branches re-seed on every push, so the rehearsal cannot borrow one.

**Trade-offs:** Development no longer has real legacy shapes on demand — the seeder has to grow to cover them, so a data-shape surprise surfaces at the rehearsal instead of while building CRUD. In exchange there is one fewer database to keep at head and no drift risk, and the rehearsal is decoupled from feature work: it can run whenever a fresh snapshot is taken, and again at cutover.

**Consequences:**

- Supersedes the dev-branch references in ADR-0024; the baseline/replay decision there stands unchanged. ADR-0027's "no dev branch to mirror it" is now the decision rather than a state found.
- The rehearsal needs a branch an operator can create and delete around one run; nothing in CI provisions it.
- #131 — whether anything migrates `production`, or previews fork a CI-maintained parent — is unaffected: a CI-maintained preview parent, if chosen, is a CI artifact, not the dev branch this ADR rejects.
- Local development still has no data environment: the fnox `DATABASE_URL` resolves to the production branch's `neondb` (ADR-0027), so running `db:seed` locally needs a deliberate target. Open, and separable from this decision.
