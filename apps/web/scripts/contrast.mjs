// Measures the rendered contrast of elements, light and dark (design-workflow.md
// step 6). For each selector's first match it reads the element's own colour
// (an SVG icon's stroke) and the pixels actually behind it, with its ink made
// transparent, and compares it with the colour most of those pixels have: the
// surface it sits on, art included, and not a border or a rounded corner at
// the edge of its box. Text needs 4.5:1, or 3:1 when large (24px, or 18.66px
// bold); an icon needs 3:1 (WCAG 2.2 1.4.3, 1.4.11). Exits 1 when a pair fails.
//
//   node apps/web/scripts/contrast.mjs <url> <selector>... [--state <name>] [--viewport 1440x900] [--login]
import { URL } from "node:url";
import * as playwright from "playwright";
import { openPage, option, setScheme, stateOrExit } from "./page-states.mjs";
import { signIn } from "./sign-in.mjs";

const args = process.argv.slice(2);
const valued = new Set(["--state", "--viewport"]);
const flags = [];
const selectors = [];
for (let index = 1; index < args.length; index++) {
  if (valued.has(args[index])) flags.push(args[index], args[++index]);
  else if (args[index].startsWith("--")) flags.push(args[index]);
  else selectors.push(args[index]);
}
const url = args[0];
if (!url || selectors.length === 0) {
  console.error(
    "usage: contrast.mjs <url> <selector>... [--state <name>] [--viewport 1440x900] [--login]"
  );
  process.exit(1);
}
const state = stateOrExit(option(flags, "--state"));
const [width, height] = (option(flags, "--viewport") ?? "1440x900").split("x").map(Number);

const browser = await playwright.chromium.launch();
let storageState;
if (flags.includes("--login")) {
  const context = await browser.newContext();
  await signIn(context, new URL(url).origin);
  storageState = await context.storageState();
  await context.close();
}

/** @type {Record<string, Record<string, string>>} */
const results = {};
let failed = false;
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    storageState
  });
  const page = await openPage(context, url, state, 1000);
  await setScheme(page, scheme);
  await page.addStyleTag({
    content:
      ".contrast-probe-ink, .contrast-probe-ink * { color: transparent !important; -webkit-text-fill-color: transparent !important; stroke: transparent !important; caret-color: transparent !important; }"
  });
  // A blank page decodes the screenshots, clear of the app's own policies.
  const decoder = await context.newPage();
  for (const selector of selectors) {
    const element = page.locator(selector).first();
    results[selector] ??= {};
    if ((await element.count()) === 0) {
      results[selector][scheme] = "not found";
      continue;
    }
    await element.scrollIntoViewIfNeeded();
    const ink = await element.evaluate((node) => {
      const style = getComputedStyle(node);
      const isIcon = node instanceof SVGElement;
      const canvas = document.createElement("canvas").getContext("2d");
      canvas.fillStyle = isIcon ? style.stroke : style.color;
      canvas.fillRect(0, 0, 1, 1);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      node.classList.add("contrast-probe-ink");
      return {
        rgb: [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)],
        needs: isIcon || large ? 3 : 4.5
      };
    });
    await page.waitForTimeout(50);
    const box = await element.boundingBox();
    const png = (await page.screenshot({ clip: box })).toString("base64");
    await element.evaluate((node) => node.classList.remove("contrast-probe-ink"));
    const ratio = await decoder.evaluate(
      async ([png, ink]) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height).getContext("2d");
        canvas.drawImage(image, 0, 0);
        const { data } = canvas.getImageData(0, 0, image.width, image.height);
        const counts = new Map();
        for (let index = 0; index < data.length; index += 4) {
          const key = `${data[index]},${data[index + 1]},${data[index + 2]}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const surface = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])[0][0]
          .split(",")
          .map(Number);
        const channel = (value) => {
          const c = value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        const luminance = ([r, g, b]) =>
          0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        const [light, dark] = [luminance(ink), luminance(surface)].sort((a, b) => b - a);
        return (light + 0.05) / (dark + 0.05);
      },
      [png, ink.rgb]
    );
    const pass = ratio >= ink.needs;
    failed ||= !pass;
    results[selector][scheme] =
      `${ratio.toFixed(2)}:1${pass ? "" : ` FAIL (needs ${ink.needs}:1)`}`;
    results[selector].needs = `${ink.needs}:1`;
  }
  await context.close();
}
await browser.close();

console.log("| Element | Light | Dark | Needs |");
console.log("| --- | --- | --- | --- |");
for (const selector of selectors) {
  const row = results[selector];
  console.log(`| \`${selector}\` | ${row.light} | ${row.dark} | ${row.needs ?? "-"} |`);
}
process.exit(failed ? 1 : 0);
