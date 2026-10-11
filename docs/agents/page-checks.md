# Page checks: screenshots and Lighthouse

Look at a page yourself before asking the user to: after a UI change, before handing over a preview link, and whenever a performance question comes up. The scripts below run against a deployed page or local dev, signed in or not.

## Where to point them

- **A PR preview.** PRs that touch code paths (`scripts/code-relevant-paths.sh`) get a preview once their `Create Environment` check passes. The sticky "Preview environment" comment lists the URL: `gh pr view <n> --json comments --jq '.comments[].body' | grep -o 'https://[^ )]*vmb-web.pages.dev' | head -1`.
- **Local dev**, after `scripts/dev-db.sh up` has seeded your branch, with `apps/api` and `apps/web` both running (`pnpm dev`).
- **A before/after baseline.** Open a throwaway draft PR from `master` to get a preview of the old code on the same kind of deployment (as #295 did for #293), and close it afterwards. Production is no baseline: it has a different API, different data and no preview user.

## Signed-in pages

Pass `--login` to any of the scripts. It signs in through `/login` as the seeded preview user, `preview@vmblogistics.id` / `preview-password` (`packages/db/src/seed/data/master.ts`; override with `VMB_LOGIN_EMAIL` / `VMB_LOGIN_PASSWORD`). That user exists on every preview and on a seeded local branch, never on production. Without `--login`, a signed-in URL redirects to `/login`, and the scripts stop with an error rather than capture the login page.

## States

`--state <name>` opens a page partway through a flow, so a check reaches what a user sees after acting: `activate:code`, `activate:resent`, `activate:password`, `activate:password-warning` and `login:errors` (`apps/web/scripts/page-states.mjs`; add a state there when a screen grows one). It sets the step cookies the server reads and stubs a form's reply where the state needs one, so it works on a preview and on local dev without the API running. The screenshot, probe and contrast scripts all take it; `<url>` then only gives the origin.

## Screenshots

`node apps/web/scripts/design-screenshots.mjs <url> <out-dir> [--state <name>] [--login]` captures the review viewports in light and dark. Read every capture. T3's preview tools are fine for a quick look, but a hidden preview tab pauses CSS animations, so use the script for anything with entrance motion. Keep one-off probe scripts and captures in a temp directory, outside the repo, and upload the captures a PR cites as evidence with `scripts/upload-asset.sh <file> prs/<pr-number>`.

## Fit and contrast

- `node apps/web/scripts/design-probe.mjs <url> [--state <name>] [--baseline <url>]` prints a Markdown table of each review viewport's page height, whether it scrolls, and the auth sheet's height (`--selector` for another element). With `--baseline`, cells show the baseline's value where it differs.
- `node apps/web/scripts/contrast.mjs <url> <selector>... [--state <name>]` measures each element's rendered contrast in light and dark against the pixels behind it, and exits 1 when a pair is under 4.5:1 (3:1 for large text and icons).
- `node apps/web/scripts/layer-squeeze.mjs <origin> --login` opens the `/design-system` layer on a step at 768px, jumps to a 425px phone through the same CDP calls as a DevTools device preset, and exits 1 unless the sheet keeps the step and `body` has no padding (ADR-0053 rule 6).
- `node apps/web/scripts/contact-sheet.mjs <out.png> <width> "Label=file.png"...` lays captures side by side for a README or a review.

## A preview's one-time code

Previews never send email (`EMAIL_TRANSPORT=log`, ADR-0019): the API logs it, code included. Request the code on the preview, then open the PR's Worker Preview of `vmb-api` in the Cloudflare dashboard, go to **Observability**, and search `suppressed outbound email`. Codes expire after 5 minutes.

## Local dev servers

Several worktrees often run at once, so start each `vite dev` on its own port (`--port <n> --strictPort`) and fail fast rather than reach another worktree's server. Start it as a background task with a long timeout; a short one stops it mid-check.

## Lighthouse

`node apps/web/scripts/lighthouse.mjs <url> [--login] [--runs 3] [--desktop]` runs the performance category and prints score, FCP, LCP, TBT and CLS per run plus the median. Preview scores swing by a few points between runs, so compare medians of five or more runs. The JSON reports stay in the directory it prints, for drilling into an audit (`jq '.audits["render-blocking-insight"].details'`).

