// Renders a page at the design review viewports, light and dark, for the
// verify step of docs/agents/design-workflow.md.
//
//   node apps/web/scripts/design-screenshots.mjs <url> <out-dir> [--wait 4000] [--browser chromium|firefox|webkit] [--login]
//
// `--login` signs in first (sign-in.mjs), for pages behind the app shell.
// Waits for one-shot entrance motion to settle before each capture. Dark mode
// is the `.dark` class on <html>, as the app sets it (ADR-0035 rule 7).
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { URL } from "node:url";
import * as playwright from "playwright";
import { isLoginPage, signIn } from "./sign-in.mjs";

const VIEWPORTS = [
  [1920, 1080],
  [1680, 1000],
  [1440, 900],
  [1366, 768],
  [1024, 923],
  [390, 844]
];

const [url, outDir, ...flags] = process.argv.slice(2);
if (!url || !outDir) {
  console.error(
    "usage: design-screenshots.mjs <url> <out-dir> [--wait 4000] [--browser chromium|firefox|webkit] [--login]"
  );
  process.exit(1);
}
const waitIndex = flags.indexOf("--wait");
const wait = waitIndex === -1 ? 4000 : Number(flags[waitIndex + 1]);
const browserIndex = flags.indexOf("--browser");
const browserName = browserIndex === -1 ? "chromium" : flags[browserIndex + 1];
if (!["chromium", "firefox", "webkit"].includes(browserName)) {
  console.error(`unknown browser: ${browserName}`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const browser = await playwright[browserName].launch();
let storageState;
if (flags.includes("--login")) {
  const context = await browser.newContext();
  await signIn(context, new URL(url).origin);
  storageState = await context.storageState();
  await context.close();
}
for (const [width, height] of VIEWPORTS) {
  for (const scheme of ["light", "dark"]) {
    // The page's own theme code follows the colour scheme; adding the class after
    // the wait keeps a late hydration from resetting it (a few captures came out
    // light that way).
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: scheme,
      storageState
    });
    await page.goto(url, { waitUntil: "networkidle" });
    if (isLoginPage(page.url()) && !isLoginPage(url)) {
      console.error(`${url} redirected to ${page.url()}: pass --login for a signed-in page`);
      process.exit(1);
    }
    await page.waitForTimeout(wait);
    if (scheme === "dark") {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.waitForTimeout(300);
    }
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const file = join(outDir, `${width}x${height}-${scheme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file, scrollHeight > height ? `scrolls to ${scrollHeight}px` : "fits");
    await page.close();
  }
}
await browser.close();
