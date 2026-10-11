// Checks that a layer handed over by a DevTools device preset doesn't squeeze
// the page (ADR-0053 rule 6). The panel is open on a step at 768px; the
// window then jumps to a 425px phone with mobile emulation, as a DevTools
// preset does, through the same CDP calls. The sheet that takes over must
// keep the step, and leave `body` without padding: opened while the window
// still reports the panel's old width, its scroll lock pads the page by the
// difference.
//
//   node apps/web/scripts/layer-squeeze.mjs <origin> [--login] [--path /design-system]
//
// Exits 1 when the check fails.
import { URL } from "node:url";
import * as playwright from "playwright";
import { option } from "./page-states.mjs";
import { signIn } from "./sign-in.mjs";

const [origin, ...flags] = process.argv.slice(2);
if (!origin) {
  console.error("usage: layer-squeeze.mjs <origin> [--login] [--path /design-system]");
  process.exit(1);
}
const path = option(flags, "--path") ?? "/design-system";

const browser = await playwright.chromium.launch();
const context = await browser.newContext();
if (flags.includes("--login")) await signIn(context, new URL(origin).origin);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const preset = (width, height, mobile) =>
  cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile
  });

await preset(768, 1024, false);
await page.goto(new URL(path, origin).href);
await page.waitForLoadState("networkidle");
await page.locator("[data-layer-trigger]").first().click();
await page.locator("[data-layer-frame=panel]").waitFor();
await page.locator("[data-layer-frame=panel] [data-slot=filter-date-row]").first().click();
const before = await page.locator("[data-layer-frame=panel] [data-layer-title]").textContent();

await preset(425, 900, true);
await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
// the handover waits 200ms for the resize to settle, then up to 1s for the page
await page.locator("[data-layer-frame=modal]").waitFor({ timeout: 5000 });
await page.waitForTimeout(1500);

const after = await page.evaluate(() => ({
  title: document.querySelector("[data-layer-frame=modal] [data-layer-title]")?.textContent?.trim(),
  padding: getComputedStyle(document.body).paddingRight,
  window: globalThis.innerWidth,
  page: document.documentElement.clientWidth
}));
await browser.close();

console.log(`panel step: ${before?.trim()}`);
console.log(
  `sheet step: ${after.title}; body padding-right ${after.padding}; window ${after.window}px, page ${after.page}px`
);
const failures = [
  after.padding !== "0px" && `body padding-right is ${after.padding}, not 0px`,
  after.title !== before?.trim() && `the sheet opened on "${after.title}", not "${before?.trim()}"`
].filter(Boolean);
for (const failure of failures) console.error(`FAIL: ${failure}`);
process.exit(failures.length ? 1 : 0);
