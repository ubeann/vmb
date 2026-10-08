// Renders a page at the design review viewports, light and dark, for the
// verify step of docs/agents/design-workflow.md.
//
//   node apps/web/scripts/design-screenshots.mjs <url> <out-dir> [--state <name>] [--wait 4000] [--browser chromium|firefox|webkit] [--login]
//
// `--state` opens a page partway through a flow, such as `activate:code`
// (page-states.mjs lists them); <url> then only gives the origin. `--login`
// signs in first (sign-in.mjs), for pages behind the app shell. Waits for
// one-shot entrance motion to settle before each capture. Dark mode is the
// `.dark` class on <html>, as the app sets it (ADR-0035 rule 7).
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { URL } from "node:url";
import * as playwright from "playwright";
import { VIEWPORTS, openPage, option, setScheme, stateOrExit } from "./page-states.mjs";
import { isLoginPage, signIn } from "./sign-in.mjs";

const [url, outDir, ...flags] = process.argv.slice(2);
if (!url || !outDir) {
  console.error(
    "usage: design-screenshots.mjs <url> <out-dir> [--state <name>] [--wait 4000] [--browser chromium|firefox|webkit] [--login]"
  );
  process.exit(1);
}
const wait = Number(option(flags, "--wait") ?? 4000);
const browserName = option(flags, "--browser") ?? "chromium";
if (!["chromium", "firefox", "webkit"].includes(browserName)) {
  console.error(`unknown browser: ${browserName}`);
  process.exit(1);
}
const stateName = option(flags, "--state");
const state = stateOrExit(stateName);

await mkdir(outDir, { recursive: true });
const browser = await playwright[browserName].launch();
let storageState;
if (flags.includes("--login")) {
  const context = await browser.newContext();
  await signIn(context, new URL(url).origin);
  storageState = await context.storageState();
  await context.close();
}
const prefix = stateName ? `${stateName.replace(":", "-")}-` : "";
for (const [width, height] of VIEWPORTS) {
  for (const scheme of ["light", "dark"]) {
    // The page's own theme code follows the colour scheme; adding the class after
    // the wait keeps a late hydration from resetting it (a few captures came out
    // light that way).
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: scheme,
      storageState
    });
    const page = await openPage(context, url, state, wait);
    if (isLoginPage(page.url()) && !isLoginPage(state ? new URL(state.path, url).href : url)) {
      console.error(`${url} redirected to ${page.url()}: pass --login for a signed-in page`);
      process.exit(1);
    }
    if (scheme === "dark") await setScheme(page, "dark");
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const file = join(outDir, `${prefix}${width}x${height}-${scheme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file, scrollHeight > height ? `scrolls to ${scrollHeight}px` : "fits");
    await context.close();
  }
}
await browser.close();
