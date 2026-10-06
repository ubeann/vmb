# Page checks: screenshots and Lighthouse

Look at a page yourself before asking the user to: after a UI change, before handing over a preview link, and whenever a performance question comes up. Both scripts below run against a deployed page, signed in or not.

## Where to point them

- **A PR preview.** PRs that touch code paths (`scripts/code-relevant-paths.sh`) get a preview once their `Create Environment` check passes. The sticky "Preview environment" comment lists the URL: `gh pr view <n> --json comments --jq '.comments[].body' | grep -o 'https://[^ )]*vmb-web.pages.dev' | head -1`.
- **Local dev**, after `scripts/dev-db.sh up` has seeded your branch, with `apps/api` and `apps/web` both running (`pnpm dev`).
- **A before/after baseline.** Open a throwaway draft PR from `master` to get a preview of the old code on the same kind of deployment (as #295 did for #293), and close it afterwards. Production is no baseline: it has a different API, different data and no preview user.

## Signed-in pages

Pass `--login` to either script. It signs in through `/login` as the seeded preview user, `preview@vmblogistics.id` / `preview-password` (`packages/db/src/seed/data/master.ts`; override with `VMB_LOGIN_EMAIL` / `VMB_LOGIN_PASSWORD`). That user exists on every preview and on a seeded local branch, never on production. Without `--login`, a signed-in URL redirects to `/login`, and both scripts stop with an error rather than capture the login page.

## Screenshots

`node apps/web/scripts/design-screenshots.mjs <url> <out-dir> [--login]` captures the review viewports in light and dark. Read every capture. T3's preview tools are fine for a quick look, but a hidden preview tab pauses CSS animations, so use the script for anything with entrance motion. Keep one-off probe scripts and captures in a temp directory, outside the repo, and upload the captures a PR cites as evidence with `scripts/upload-asset.sh <file> prs/<pr-number>`.

## Lighthouse

`node apps/web/scripts/lighthouse.mjs <url> [--login] [--runs 3] [--desktop]` runs the performance category and prints score, FCP, LCP, TBT and CLS per run plus the median. Preview scores swing by a few points between runs, so compare medians of five or more runs. The JSON reports stay in the directory it prints, for drilling into an audit (`jq '.audits["render-blocking-insight"].details'`).
