// Measures how a page fits the design review viewports (design-workflow.md
// step 6): the page's height, whether it scrolls, and the height of one
// element, the auth sheet by default. Prints a Markdown table to paste into a
// round's README. With `--baseline`, each cell also shows the baseline's value,
// for a before/after comparison against master's preview or a second dev
// server.
//
//   node apps/web/scripts/design-probe.mjs <url> [--state <name>] [--selector .auth-card] [--baseline <url>] [--login]
//
// Layout doesn't change with the colour scheme, so it measures light only.
import { URL } from "node:url";
import * as playwright from "playwright";
import { VIEWPORTS, openPage, option, stateOrExit } from "./page-states.mjs";
import { signIn } from "./sign-in.mjs";

const [url, ...flags] = process.argv.slice(2);
if (!url) {
  console.error(
    "usage: design-probe.mjs <url> [--state <name>] [--selector .auth-card] [--baseline <url>] [--login]"
  );
  process.exit(1);
}
const state = stateOrExit(option(flags, "--state"));
const selector = option(flags, "--selector") ?? ".auth-card";
const baseline = option(flags, "--baseline");

const browser = await playwright.chromium.launch();

async function measure(target) {
  let storageState;
  if (flags.includes("--login")) {
    const context = await browser.newContext();
    await signIn(context, new URL(target).origin);
    storageState = await context.storageState();
    await context.close();
  }
  const rows = [];
  for (const [width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, storageState });
    const page = await openPage(context, target, state);
    await page.evaluate(() => document.fonts.ready);
    rows.push(
      await page.evaluate(
        ([selector, height]) => {
          const page = document.documentElement.scrollHeight;
          const element = document.querySelector(selector);
          return {
            page,
            fits: page <= height,
            element: element ? Math.round(element.getBoundingClientRect().height) : undefined
          };
        },
        [selector, height]
      )
    );
    await context.close();
  }
  return rows;
}

const now = await measure(url);
const before = baseline ? await measure(baseline) : undefined;
await browser.close();

const cell = (value, base) =>
  base === undefined || value === base ? `${value}` : `${value} (${base})`;
console.log(`| Viewport | Page height | Fits | \`${selector}\` height |`);
console.log("| --- | --- | --- | --- |");
VIEWPORTS.forEach(([width, height], index) => {
  const row = now[index];
  const base = before?.[index];
  const fits = row.fits ? "fits" : "scrolls";
  console.log(
    `| ${width} × ${height} | ${cell(row.page, base?.page)} | ${base && base.fits !== row.fits ? `${fits} (${base.fits ? "fits" : "scrolls"})` : fits} | ${cell(row.element ?? "none", base?.element ?? (base ? "none" : undefined))} |`
  );
});
if (baseline) console.log(`\nIn brackets: ${baseline}, where it differs.`);
