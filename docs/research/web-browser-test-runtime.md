# Research: web browser test suite runtime

Measured 2026-10-06 for #288, on `master` at `0dbb212` (after #291 made web `build`, `typecheck` and
`test` run in parallel). Local numbers are from an 8-core Apple Silicon machine; CI numbers are from
the `ubuntu-latest` runner this private repo gets, which reports `nproc` = 2 and
`availableParallelism()` = 2. The CI bench ran from draft PR #294 (runs 37350269842 and
37351023606), which was a temporary workflow and is not kept.

**Conclusion: no change.** The suite spends its time on real browser interaction rather than setup.
No configuration lever saves enough on the 2-core runner to justify itself.

## Where the time goes

`@vmb/web:test` is two vitest projects: `unit` (Node, 25 files) and `component` (browser mode,
27 files locally / 28 on CI). Locally, the component project uses about 24s of CPU against about 8s
for unit, so it is the one that matters.

Vitest reports most of the component time as "worker". That label covers everything that happens in
the browser iframe, not setup overhead:

| Measurement (local, 1 worker)      | Result                             |
| ---------------------------------- | ---------------------------------- |
| Browser start, one trivial file    | about 0.5s                         |
| Each extra trivial file            | about 35ms (the same with app.css) |
| Test bodies, all 27 files          | about 5.8s                         |
| Module imports across the 27 files | about 3.5s                         |

Four files take 85% of test-body time, and each does real clicks and `expect.poll` waits on UI state,
with no fixed sleeps:

| File                                         | Time  | Tests |
| -------------------------------------------- | ----- | ----- |
| `routes/(auth)/activate/page.svelte.test.ts` | 2.40s | 81    |
| `lib/components/ThemeToggle.svelte.test.ts`  | 1.05s | 5     |
| `routes/a11y.svelte.test.ts` (axe)           | 0.93s | 30    |
| `routes/(auth)/login/page.svelte.test.ts`    | 0.53s | 19    |

The other 23 component files take under 0.25s together, so moving any of them to the `unit` project
would save nothing worth the loss of a real browser.

## Options measured

**Turning off isolation** (`--no-isolate`): unsafe. 13 to 14 of 27 files failed, and tests hung on
15s timeouts because state leaked between files.

**Worker count and browser build**, on the CI runner:

| Component tests alone     | Run 1 | Run 2 |
| ------------------------- | ----- | ----- |
| Chrome, 1 worker (today)  | 43.7s | 37.2s |
| Chrome, 2 workers         | 31.8s | 37.0s |
| Headless shell, 1 worker  | 36.9s | 35.0s |
| Headless shell, 2 workers | 28.2s | 28.4s |

| `build` + `typecheck` + `test` in parallel, as `Verify` runs them | Run 1 | Run 2 | Average |
| ----------------------------------------------------------------- | ----- | ----- | ------- |
| Chrome, 1 worker (today)                                          | 60.0s | 52.2s | 56.1s   |
| Chrome, 2 workers                                                 | 53.7s | 53.6s | 53.7s   |
| Headless shell, 1 worker                                          | 50.2s | 50.2s | 50.2s   |
| Headless shell, 2 workers                                         | 50.6s | 50.5s | 50.5s   |

On its own, the suite is fastest with the headless shell and 2 workers. But `Verify` never runs it
alone: `build` and `typecheck` fill the same 2 cores, and there the worker count stops mattering.
The headless shell saves about 6s on average, because it uses 12 to 30% less CPU than full Chrome
(measured locally).

## Why no change

- **Worker count:** no gain where it counts, under the parallel run.
- **Headless shell:** about 6s saved, but the runner has to download it. That took about 6s uncached
  (it needs no OS packages, unlike the full browser ADR-0021 dropped), or a few seconds from the
  Actions cache. That nets out to roughly nothing. It would also mean testing a different browser
  build from the Chrome users run, which is what ADR-0021 chose.
- **Billing:** `Verify` is billed per started minute. A few seconds won't move a typical run across a
  minute boundary.

## The `derived_inert` warning

Svelte's `derived_inert` warning ("reading a derived belonging to a now-destroyed effect") doesn't
appear at `0dbb212`. It was in the CI logs of the app-shell branch (#281), which has since merged. It
may point to an effect that outlives its component there, but it doesn't slow the suite. If it shows
up on `master`, track it as its own issue.

## When to look again

- The runner gets more cores (a public repo or a larger runner): the 2-worker and headless-shell
  numbers above were the better ones when the suite had the cores to itself.
- `web:test` grows enough to take much longer than `build` and `typecheck`. Then it alone sets the
  length of the parallel run, and the "alone" table is the one to use.
- A single file grows to dominate. Today `activate/page.svelte.test.ts` is 41% of test-body time.
