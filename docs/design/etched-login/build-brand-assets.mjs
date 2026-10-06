// Builds the icon set and link-preview image in apps/web/static from the logo
// and the auth etching (#207). Rerun after either source changes:
//
//   node docs/design/etched-login/build-brand-assets.mjs
//
// Palette values come from app.css (ADR-0035), including the dark icon variant.
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

const require = createRequire(new URL("../../../apps/web/package.json", import.meta.url));
const { chromium } = require("playwright");
const root = (path) => fileURLToPath(new URL(`../../../apps/web/${path}`, import.meta.url));
const STATIC = root("static");

const css = await readFile(root("src/app.css"), "utf8");
const theme = (selector) => {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1];
  if (!block) throw new Error(`Missing ${selector} theme in app.css`);
  return (name) => {
    const value = block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];
    if (!value) throw new Error(`Missing --${name} in ${selector} theme`);
    return value;
  };
};
const light = theme(":root");
const dark = theme("\\.dark");
const PAPER = light("background");
const INK = light("foreground");
const MUTED = light("muted-foreground");
const ETCHING = light("etching");
const LIGHT = { mark: light("brand-mark"), stripes: light("primary") };
const DARK = { mark: dark("brand-mark"), stripes: dark("primary") };

const logo = await readFile(fileURLToPath(new URL("./vmb-logo.svg", import.meta.url)), "utf8");
const paths = [...logo.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]+)"\/>/g)];
if (paths.length !== 2) {
  throw new Error("vmb-logo.svg must contain the navy swoosh and green stripes");
}
const [markPath, stripesPath] = paths.map((match) => match[2]);

// The logo's viewBox, and the same box padded top and bottom to a square.
const LOGO_BOX = "205 260 1621 972";
const SQUARE = "205 -64.5 1621 1621";

// The favicon is the real mark, not a redraw: at 16px the letters cut out of
// the green blur, but the swoosh-and-oval silhouette stays the brand's. The
// cutouts are transparent, so the tab strip shows through them — paper-like
// in light browsers, dark in dark ones, as the logo reads in the app.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SQUARE}"><style>.m{fill:${LIGHT.mark}}.s{fill:${LIGHT.stripes}}@media (prefers-color-scheme:dark){.m{fill:${DARK.mark}}.s{fill:${DARK.stripes}}}</style><path class="m" d="${markPath}"/><path class="s" d="${stripesPath}"/></svg>\n`;

const logoSvg = (viewBox) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="${LIGHT.mark}" d="${markPath}"/><path fill="${LIGHT.stripes}" d="${stripesPath}"/></svg>`;
const dataUri = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
const logoUri = dataUri("image/svg+xml", logoSvg(LOGO_BOX));

// Opaque paper tiles: iOS fills a transparent touch icon with black, and the
// .ico has no dark-scheme variant, so neither can rely on the tab strip.
const tile = (size, radius, inset) => `
  <body style="margin:0">
    <div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${PAPER};display:grid;place-items:center">
      <img src="${logoUri}" style="width:${size - inset * 2}px">
    </div>
  </body>`;

const font = async (file) =>
  dataUri("font/woff2", await readFile(root(`node_modules/@fontsource-variable/${file}`)));
const newsreader = await font("newsreader/files/newsreader-latin-opsz-normal.woff2");
const schibsted = await font("schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2");
const etching = dataUri(
  "image/webp",
  await readFile(root("src/lib/assets/auth/vmb-etching-2400.webp"))
);

// The auth page in miniature: masthead, brand line, and the engraved
// panorama along the foot, filled with `--etching` as EtchedScene does. JPEG,
// since WhatsApp drops preview images over about 300 KB.
const ogImage = `
  <style>
    @font-face { font-family: Newsreader; src: url(${newsreader}); font-weight: 200 800; }
    @font-face { font-family: Schibsted; src: url(${schibsted}); font-weight: 400 900; }
    body { margin: 0; }
    .card { position: relative; width: 1200px; height: 630px; overflow: hidden; background: ${PAPER}; color: ${INK}; font-family: Schibsted; }
    .logo { position: absolute; left: 72px; top: 60px; height: 64px; }
    .kicker { position: absolute; right: 72px; top: 84px; margin: 0; color: ${MUTED}; font-size: 17px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; }
    h1 { position: absolute; left: 72px; top: 172px; width: 820px; margin: 0; font: 400 68px/1.05 Newsreader; letter-spacing: -0.02em; }
    .plate { position: absolute; inset: auto 0 0; height: 250px; background: ${ETCHING}; mask: url(${etching}) center bottom / auto 100% no-repeat; }
  </style>
  <div class="card">
    <img class="logo" src="${logoUri}">
    <p class="kicker">Warehouse · Trucking · Expense</p>
    <h1>Every crate, container and receipt, on record.</h1>
    <div class="plate"></div>
  </div>`;

const browser = await chromium.launch();
const render = async (html, width, height, options = {}) => {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png", ...options });
  await page.close();
  return png;
};

const touchIcon = await render(tile(180, 0, 14), 180, 180);
const icoPng = await render(tile(32, 6, 1), 32, 32, { omitBackground: true });
const og = await render(ogImage, 1200, 630, { type: "jpeg", quality: 85 });
await browser.close();

// An ICO holding one PNG image: a 6-byte header and a 16-byte directory entry.
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // one image
ico.writeUInt8(32, 6); // width
ico.writeUInt8(32, 7); // height
ico.writeUInt16LE(1, 10); // colour planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(icoPng.length, 14);
ico.writeUInt32LE(22, 18); // image offset

await writeFile(`${STATIC}/favicon.svg`, faviconSvg);
await writeFile(`${STATIC}/favicon.ico`, Buffer.concat([ico, icoPng]));
await writeFile(`${STATIC}/apple-touch-icon.png`, touchIcon);
await writeFile(`${STATIC}/og-image.jpg`, og);
console.log("wrote favicon.svg, favicon.ico, apple-touch-icon.png, og-image.jpg to", STATIC);
