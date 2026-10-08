// Lays screenshots side by side, each under its label, in one PNG: for
// comparing options or before and after in a round's README or a review.
//
//   node apps/web/scripts/contact-sheet.mjs <out.png> <column-width> "Label=path/to/image.png"...
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as playwright from "playwright";

const [out, width, ...items] = process.argv.slice(2);
const column = Number(width);
if (!out || !column || items.length === 0) {
  console.error('usage: contact-sheet.mjs <out.png> <column-width> "Label=path/to/image.png"...');
  process.exit(1);
}

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const figures = items.map((item) => {
  const split = item.indexOf("=");
  const [label, path] = [item.slice(0, split), item.slice(split + 1)];
  return `<figure style="margin:0;width:${column}px"><figcaption style="margin-bottom:10px">${escape(label)}</figcaption><img src="${pathToFileURL(resolve(path)).href}" style="width:${column}px;display:block;border:1px solid #cfcabd"></figure>`;
});
const html = `<!doctype html><body style="margin:0;padding:24px;display:flex;gap:24px;align-items:flex-start;background:#e9e6de;color:#1b2550;font:600 20px system-ui">${figures.join("")}</body>`;

// A file page, so the images load from disk.
const dir = await mkdtemp(join(tmpdir(), "contact-sheet-"));
const sheetFile = join(dir, "sheet.html");
await writeFile(sheetFile, html);
const browser = await playwright.chromium.launch();
const page = await browser.newPage({
  viewport: { width: items.length * (column + 24) + 24, height: 300 }
});
await page.goto(pathToFileURL(sheetFile).href);
await page.waitForLoadState("load");
await page.screenshot({ path: out, fullPage: true });
await browser.close();
await rm(dir, { recursive: true });
console.log(out);
