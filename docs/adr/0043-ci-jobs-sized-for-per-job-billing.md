# ADR-0043: CI jobs are sized for per-job minute billing

**Context:** The repository is private on GitHub Free, which includes 2,000 Actions minutes a month and stops Actions at the limit when no payment method is set. GitHub bills each job rounded up to a whole minute. CI history from 2026-09-17 to 2026-10-02 projects to about 4,050 billed minutes per 30 days, with an 82% gap between raw and billed time (`docs/research/nx-cloud-vs-turborepo.md`). Two `ci.yml` jobs account for most of the avoidable part:

- `Lint Workflows and Scripts` ran for about 14 s and billed a full minute on every run, about 14% of billed minutes. It was a job of its own so a broken workflow read as a workflow failure, not a test failure (#61, #79).
- `Real Postgres` ran `pnpm --filter @vmb/db test` outside turbo, so it re-ran the suite on every run and billed two minutes, about 22% of billed minutes. The same `@vmb/db:test` replays from cache in `Verify` about 88% of the time.

The task runner itself is about 9% of billed minutes at a 75–80% task cache hit rate, so replacing Turborepo would not reduce this (ADR-0008 stands).

**Options considered:**

- Fold the workflow and script lints into `Verify` as named steps — chosen. `Verify` already installs the full toolchain, so they add a few seconds there and drop one billed minute per run.
- Keep the lint job separate — rejected: it buys only failure attribution, which named steps already give, the reasoning ADR-0023 applied to `Format`.
- Run `Real Postgres` through turbo, with the server's image ID in the hash — chosen. The suite replays when neither `@vmb/db`, its dependencies nor the server changed, which takes the job under a minute.
- Hash only the `postgres:18` tag — rejected: the tag stays the same across minor releases, so a new server would never be tested until code changed.
- Fold `Real Postgres` into `Verify` — rejected: it needs a service container that every `Verify` run would then start.
- Pay for minutes over the quota (about $12/month at the projected pace) — not chosen now. It stays the fallback if the two changes above are not enough.

**Decision:** A check that runs for seconds is a named step in an existing job, not a job of its own, unless it needs a different environment. A job that runs a turbo task runs it through `turbo`, with anything outside the repository that changes its result, such as a service image, added to the task's `env` in `turbo.json`. The workflow and script lints run at the end of `Verify` under `!cancelled()`, so they still report when an earlier step fails. `Real Postgres` passes the service's image ID as `TEST_DATABASE_IMAGE`.

**Trade-offs:** A workflow lint failure now marks `Verify` red rather than a separate check, so the failing step name, not the check name, says what broke. `Real Postgres` no longer re-checks an unchanged `@vmb/db` against an unchanged server on every run; it trusts the cached result, as `Verify` already does for every other task. `Real Postgres` now receives the turbo cache token, which it did not before; Dependabot runs still get no secrets and run the suite from scratch. In return, the two changes are estimated to save about 1,000 billed minutes per 30 days, bringing CI back near the free quota without a paid plan.
