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

## CSP violations

`node apps/web/scripts/csp-check.mjs <origin> [--login] [--browsers chromium,firefox,webkit] [--ignore-report-only]` opens the app's screens in Chromium, Firefox and WebKit and collects every `securitypolicyviolation` event, from the enforced policy and the report-only one (ADR-0047, point 4). It prints a row per violation with its page, step, browser, scheme, policy, directive, blocked URI and source file, and exits 1 on any. Run it on a PR preview, never local dev: SvelteKit loosens styles in dev, so style violations only show on a production build. A local `pnpm build` served by `wrangler pages dev .svelte-kit/cloudflare` is a production build too, but signed out only without an API.

Re-run it when the policy changes, when a screen or overlay is added, and after bumping bits-ui, mode-watcher or svelte-sonner, which build their own elements.

- **Signed out** (always): `/login`, `/activate`, each state of `page-states.mjs`, and the 404 page.
- **`--login`** adds `/`, `/design-system`, a signed-in 404, and the list, `new`, detail and `edit` pages of Divisions, Roles and Users (the detail and edit pages of the first record in each list). Add a route to `VISITS` or `RESOURCES` in the script when a module ships.
- **Schemes.** Each page opens in a light context and a dark one (`prefers-color-scheme`), for the first-paint script. Only the light context explores overlays.
- **Overlays.** On each page it opens every dialog, sheet, popover, menu and select it finds, closes it with Escape, and checks the page looks unlocked and still scrolls: the scroll-lock reset ADR-0047 calls out. In a menu it also opens the Delete entries, which ask a confirmation (it never confirms one, and it skips entries such as Deactivate that act at once), and a layer's date and select pickers. Signed in, it opens `?`'s shortcut sheet and a record in its layer, and runs Theme › Dark › Light through the real menu, which makes mode-watcher append its style sheet.
- **`--ignore-report-only`** still prints the report-only violations, but lets them pass. Use it on the last run of a PR that keeps a tighter variant in `kit.csp.reportOnly` to measure the next step.

It also exits 1 on a **gap**: a page that bounced to `/login` or did not load, a record or Theme button it could not find, an overlay that would not close. A gap is not a pass, so read the `GAP:` lines. A control it could not click is only a `note:`.

## A preview's one-time code

Previews never send email (`EMAIL_TRANSPORT=log`, ADR-0019): the API logs it, code included. Request the code on the preview, then open the PR's Worker Preview of `vmb-api` in the Cloudflare dashboard, go to **Observability**, and search `suppressed outbound email`. Codes expire after 5 minutes.

## Local dev servers

Several worktrees often run at once, so start each `vite dev` on its own port (`--port <n> --strictPort`) and fail fast rather than reach another worktree's server. A harness background task is stopped after two hours at most, which cut a prototype session's server three times in one afternoon. For a server that must outlive a check, start it detached and keep its PID:

```
cd apps/web && nohup pnpm exec vite dev --port <n> --strictPort > /tmp/vite-<n>.log 2>&1 &
echo $! > /tmp/vite-<n>.pid
```

Read `/tmp/vite-<n>.log` for its output, and `kill "$(cat /tmp/vite-<n>.pid)"` when the work is done. For a quick look at one width or scheme, T3's `preview_resize` and `preview_set_appearance` are enough; the screenshot script is for every viewport.

## Touch

A sheet, dialog or panel that closes on a tap outside needs a real-touch check, because bits-ui dismisses from the tap's click rather than from pointerdown; the Filter panel's tap-outside bug (#376) reached the preview before anyone tapped it. Run the Playwright check with `hasTouch: true` and `page.tap`, as the layer tests do, or open the page on an iOS simulator through T3's `device_open` (`t3-code.md`).

## Lighthouse

`node apps/web/scripts/lighthouse.mjs <url> [--login] [--runs 3] [--desktop]` runs the performance category and prints score, FCP, LCP, TBT and CLS per run plus the median. Preview scores swing by a few points between runs, so compare medians of five or more runs. The JSON reports stay in the directory it prints, for drilling into an audit (`jq '.audits["render-blocking-insight"].details'`).
