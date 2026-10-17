// Opens every screen and overlay of apps/web in Chromium, Firefox and WebKit
// and collects the `securitypolicyviolation` events the page's CSP files, from
// the enforced policy and the report-only one alike (ADR-0047, point 4). The
// policy only moves to `kit.csp.directives`, and only tightens, once this
// finds nothing unexplained. Run it on a PR preview: SvelteKit loosens styles
// in dev, so style violations only show on a production build.
//
//   node apps/web/scripts/csp-check.mjs <origin> [--login] [--browsers chromium,firefox,webkit]
//                                       [--ignore-report-only]
//
// Without --login it opens the signed-out pages: /login, /activate, each
// page-states.mjs state and the 404 page. With --login it signs in as the
// seeded preview user and adds `/`, `/design-system` and the list, detail, new
// and edit pages of Divisions, Roles and Users, plus a signed-in 404.
//
// Each page opens in a light context and a dark one (`prefers-color-scheme`),
// so the first-paint script sees both. The light context then goes further:
// it opens every dialog, sheet, popover, menu and select it finds (and, in a
// menu, the entries that open a confirmation or a layer step), closes each,
// and checks the page can still scroll, the scroll-lock reset ADR-0047 calls
// out. Signed in, it also opens `?`'s shortcut sheet, a record in its layer,
// and runs Theme > Dark > Light through the real menu, which is what makes
// mode-watcher append its style sheet.
//
// Prints each violation with its page, browser, scheme, directive and blocked
// URI. Exits 1 when there are any, and when a page or overlay it should have
// covered could not be reached: a gap is not a pass. --ignore-report-only
// still prints the report-only violations but lets them pass, for the final run
// on a preview that also carries a tighter variant.
import { URL } from "node:url";
import * as playwright from "playwright";
import { STATES, openPage, option, stateOrExit } from "./page-states.mjs";
import { isLoginPage, signIn } from "./sign-in.mjs";

const [origin, ...flags] = process.argv.slice(2);
if (!origin) {
  console.error(
    "usage: csp-check.mjs <origin> [--login] [--browsers chromium,firefox,webkit] [--ignore-report-only]"
  );
  process.exit(1);
}
const login = flags.includes("--login");
const ignoreReportOnly = flags.includes("--ignore-report-only");
const browserNames = (option(flags, "--browsers") ?? "chromium,firefox,webkit").split(",");
const base = new URL(origin).origin;

// What opens an overlay: a menu, dialog, popover, select or layer button.
const TRIGGERS = [
  '[aria-haspopup]:not([aria-haspopup="false"])',
  "[data-layer-trigger]",
  '[role="combobox"]',
  '[data-slot="tooltip-trigger"]'
].join(", ");
// What is open: a menu, dialog, select list or popover.
const OVERLAY =
  '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [data-slot="popover-content"]';
// Inside an open overlay, what opens one more: the menu entries that ask a
// confirmation (Delete, never the entry that confirms; Deactivate and Restore act at once), and a layer's pickers.
const NESTED_ENTRY = /delete/i;
const NESTED_PICKER = '[data-slot="filter-date-row"], [role="combobox"]';

// a violation fails the run unless --ignore-report-only excuses a report-only one
const counts = (p) => !(ignoreReportOnly && p.disposition === "report");
const problems = []; // violations, as { browser, scheme, page, step, ... }
const gaps = []; // pages and overlays that could not be reached
const notes = []; // things worth reading that don't fail the run
let where = { browser: "", scheme: "", page: "", step: "" };

/** A URL without its query or fragment, or the keyword/scheme `blockedURI` can be. */
function plain(uri) {
  if (!uri) return "(none)";
  try {
    const url = new URL(uri);
    // data: and blob: URLs carry their payload in the path
    if (!url.protocol.startsWith("http")) return url.protocol;
    return `${url.origin === base ? "" : url.origin}${url.pathname}`;
  } catch {
    return uri;
  }
}

function record(event) {
  problems.push({
    ...where,
    disposition: event.disposition,
    directive: event.effectiveDirective,
    blocked: plain(event.blockedURI),
    source: event.sourceFile ? `${plain(event.sourceFile)}:${event.lineNumber}` : "",
    sample: (event.sample ?? "").slice(0, 60)
  });
}

/** Files every `securitypolicyviolation` of every page of `context` through `record`. */
async function collect(context) {
  await context.exposeFunction("__cspViolation", record);
  await context.addInitScript(() => {
    document.addEventListener(
      "securitypolicyviolation",
      (event) =>
        globalThis.__cspViolation({
          disposition: event.disposition,
          effectiveDirective: event.effectiveDirective,
          blockedURI: event.blockedURI,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          sample: event.sample
        }),
      true
    );
  });
}

const wait = (page, ms) => page.waitForTimeout(ms);

/** What bits-ui's scroll lock touches, read from computed style, which CSP does not govern. */
const lockState = (page) =>
  page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    return {
      "body overflow": body.overflow,
      "html overflow": root.overflow,
      "body pointer-events": body.pointerEvents,
      "body padding-right": body.paddingRight
    };
  });

/** Scrolls with the wheel, as a user does; false when the page can scroll but did not. */
async function wheelScrolls(page) {
  const room = await page.evaluate(
    () => document.documentElement.scrollHeight - globalThis.innerHeight
  );
  if (room < 20) return true;
  const { width, height } = page.viewportSize();
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, 200);
  await wait(page, 250);
  const moved = await page.evaluate(() => globalThis.scrollY > 0);
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  return moved;
}

/** Closes whatever is open, with Escape, and says if something still is. */
async function closeAll(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press("Escape");
    await wait(page, 350);
    if ((await page.locator(OVERLAY).locator("visible=true").count()) === 0) break;
  }
  await wait(page, 400);
  return (await page.locator(OVERLAY).locator("visible=true").count()) === 0;
}

/** After an overlay closes the page must look unlocked again, and still scroll. */
async function expectUnlocked(page, before, step) {
  const closed = await closeAll(page);
  where.step = step;
  if (!closed) gaps.push(`${describe()}: an overlay did not close on Escape`);
  const after = await lockState(page);
  for (const key of Object.keys(before)) {
    if (after[key] !== before[key]) {
      gaps.push(`${describe()}: after closing, ${key} is ${after[key]}, was ${before[key]}`);
    }
  }
  if (!(await wheelScrolls(page))) gaps.push(`${describe()}: the page no longer scrolls`);
}

const describe = () => `${where.browser} ${where.scheme} ${where.page} > ${where.step}`;

async function label(locator) {
  const text = await locator
    .evaluate(
      (el) =>
        el.getAttribute("aria-label") ||
        el.textContent?.trim().replace(/\s+/g, " ").slice(0, 40) ||
        el.getAttribute("data-slot") ||
        el.tagName.toLowerCase()
    )
    .catch(() => "?");
  return text || "?";
}

/** Opens the `index`th trigger; false when it can't be reached right now. */
async function open(page, index) {
  const trigger = page.locator(TRIGGERS).nth(index);
  if (!(await trigger.isVisible().catch(() => false))) return null;
  if (!(await trigger.isEnabled().catch(() => false))) return null;
  const name = await label(trigger);
  const tooltip = (await trigger.getAttribute("data-slot")) === "tooltip-trigger";
  try {
    if (tooltip) await trigger.hover({ timeout: 3000 });
    else await trigger.click({ timeout: 3000 });
  } catch {
    notes.push(`${describe()}: could not click "${name}", skipped`);
    return null;
  }
  await wait(page, 600);
  return { trigger, name };
}

/** The overlay entries worth opening one level further, as locators. */
function nested(page) {
  const overlay = page.locator(OVERLAY).locator("visible=true");
  return overlay
    .locator('[role="menuitem"]')
    .filter({ hasText: NESTED_ENTRY })
    .or(overlay.locator(NESTED_PICKER));
}

/** Opens, and closes, every overlay trigger on the page, and the entries inside that ask one more. */
async function overlays(page) {
  let opened = 0;
  for (let index = 0; index < (await page.locator(TRIGGERS).count()); index++) {
    const before = await lockState(page);
    const first = await open(page, index);
    if (!first) continue;
    where.step = first.name;
    opened++;
    const count = await nested(page).count();
    await expectUnlocked(page, before, first.name);
    for (let entry = 0; entry < count; entry++) {
      if (!(await open(page, index))) break;
      const target = nested(page).nth(entry);
      const name = await label(target);
      try {
        await target.click({ timeout: 3000 });
      } catch {
        notes.push(`${describe()}: could not click "${name}" inside "${first.name}", skipped`);
        await closeAll(page);
        continue;
      }
      await wait(page, 600);
      opened++;
      // a Delete entry must have asked, not acted: nothing here may change a record
      const asked = await page
        .locator('[role="alertdialog"], [role="dialog"]')
        .locator("visible=true")
        .count();
      if (!asked && /delete/i.test(name)) {
        gaps.push(`${describe()}: "${name}" opened no confirmation, so it may have acted`);
      }
      await expectUnlocked(page, before, `${first.name} > ${name}`);
    }
  }
  return opened;
}

/** `?` opens the shortcut sheet on a signed-in page. */
async function shortcutSheet(page) {
  where.step = "shortcut sheet";
  const before = await lockState(page);
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("?");
  await wait(page, 600);
  if ((await page.locator('[role="dialog"]').locator("visible=true").count()) === 0) {
    gaps.push(`${describe()}: "?" did not open the shortcut sheet`);
    return 0;
  }
  await expectUnlocked(page, before, "shortcut sheet");
  return 1;
}

/**
 * Theme > Dark, then Theme > Light: mode-watcher appends its style sheet on each.
 * The signed-in shell keeps the choice in the profile menu; the error page has
 * the masthead's Theme button.
 */
async function theme(page) {
  where.step = "theme";
  const menu = page
    .getByRole("button", { name: /account menu$/ })
    .or(page.getByRole("button", { name: "Theme", exact: true }))
    .first();
  if (!(await menu.isVisible().catch(() => false))) {
    gaps.push(`${describe()}: no profile menu or Theme button`);
    return 0;
  }
  for (const mode of ["Dark", "Light"]) {
    const radio = page.getByRole("menuitemradio", { name: mode, exact: true });
    // the profile menu stays open after a choice, the Theme menu closes
    if (!(await radio.isVisible().catch(() => false))) {
      await menu.click();
      await wait(page, 400);
    }
    await radio.click();
    await wait(page, 700);
    const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    if (dark !== (mode === "Dark")) gaps.push(`${describe()}: choosing ${mode} left dark=${dark}`);
  }
  await closeAll(page);
  return 2;
}

/** From a list, a click on the first record opens it in its layer; Escape closes it. */
async function recordLayer(page, listPath) {
  where.step = "record in its layer";
  const row = page.locator(`main a[href^="${listPath}/"]`).first();
  if (!(await row.isVisible().catch(() => false))) {
    gaps.push(`${describe()}: no record to open in a layer`);
    return 0;
  }
  const before = await lockState(page);
  await row.click();
  await wait(page, 900);
  await expectUnlocked(page, before, "record in its layer");
  return 1;
}

const VISITS = {
  public: [
    { path: "/login" },
    { path: "/activate" },
    ...Object.keys(STATES).map((name) => ({ path: STATES[name].path, state: name })),
    { path: "/csp-check-no-such-page", name: "/404" }
  ],
  signedIn: [
    { path: "/" },
    { path: "/design-system" },
    { path: "/csp-check-no-such-page", name: "/404 (signed in)", shell: false }
  ]
};

const RESOURCES = ["divisions", "roles", "users"];

/** The first record's path under each resource, read off its list page. */
async function recordPaths(context) {
  const paths = {};
  for (const resource of RESOURCES) {
    const page = await context.newPage();
    await page.goto(new URL(`/master/${resource}`, base).href, { waitUntil: "networkidle" });
    const hrefs = await page
      .locator(`main a[href^="/master/${resource}/"]`)
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    await page.close();
    const first = hrefs.find((href) => !/\/(new|edit)$/.test(href ?? ""));
    if (first) paths[resource] = first.replace(/[?#].*/, "");
    else gaps.push(`${where.browser}: /master/${resource} lists no record to open`);
  }
  return paths;
}

async function visit(context, entry, { explore, signedIn }) {
  const name = entry.name ?? (entry.state ? `${entry.path} ${entry.state}` : entry.path);
  where = { ...where, page: name, step: "load" };
  const before = problems.length;
  let opened = 0;
  let page;
  try {
    const state = entry.state ? stateOrExit(entry.state) : undefined;
    page = await openPage(context, new URL(entry.path, base).href, state, 300);
    if (signedIn && isLoginPage(page.url())) {
      gaps.push(`${describe()}: bounced to /login`);
    } else if (explore) {
      opened += await overlays(page);
      if (signedIn && entry.shell !== false) opened += await shortcutSheet(page);
      if (signedIn && entry.list) opened += await recordLayer(page, entry.list);
      if (signedIn) opened += await theme(page);
    }
  } catch (error) {
    gaps.push(`${describe()}: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await page?.close().catch(() => {});
  }
  const found = problems.slice(before).filter(counts).length;
  console.log(
    `${found ? "✗" : "✓"} ${where.browser} ${where.scheme} ${name}` +
      `${explore ? ` (${opened} overlays)` : ""}${found ? `: ${found} violation(s)` : ""}`
  );
}

const KNOWN_BROWSERS = ["chromium", "firefox", "webkit"];
const unknown = browserNames.filter((name) => !KNOWN_BROWSERS.includes(name));
if (unknown.length) {
  console.error(`unknown browser: ${unknown.join(", ")}. Known: ${KNOWN_BROWSERS.join(", ")}`);
  process.exit(1);
}

for (const browserName of browserNames) {
  const browser = await playwright[browserName].launch();
  try {
    for (const scheme of ["light", "dark"]) {
      const explore = scheme === "light";
      const fresh = async (page) => {
        where = { browser: browserName, scheme, page, step: "" };
        const context = await browser.newContext({ colorScheme: scheme });
        await collect(context);
        return context;
      };

      // signed out: a signed-in context is bounced off /login and /activate
      const signedOut = await fresh("(signed out)");
      for (const entry of VISITS.public) {
        await visit(signedOut, entry, { explore, signedIn: false });
      }
      await signedOut.close();

      if (login) {
        const context = await fresh("sign-in");
        // the sign-in goes through /login's real form, so its violations count too
        await signIn(context, base);
        const paths = await recordPaths(context);
        const pages = [...VISITS.signedIn];
        for (const resource of RESOURCES) {
          const list = `/master/${resource}`;
          pages.push({ path: list, list }, { path: `${list}/new` });
          if (paths[resource]) {
            pages.push({ path: paths[resource] }, { path: `${paths[resource]}/edit` });
          }
        }
        for (const entry of pages) await visit(context, entry, { explore, signedIn: true });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

// ---- report ----
const counted = problems.filter(counts);
const cell = (value) => String(value).replaceAll("|", "\\|");
const table = (header, keys) => {
  const rows = new Map();
  for (const key of keys) rows.set(key, (rows.get(key) ?? 0) + 1);
  if (!rows.size) return;
  console.log(
    `\n| ${header.join(" | ")} | times |\n| ${[...header, ""].map(() => "---").join(" | ")} |`
  );
  for (const [key, times] of rows) console.log(`| ${key} | ${times} |`);
};
console.log(`\n${problems.length} violation(s), ${counted.length} counted, ${gaps.length} gap(s).`);

// By policy and directive, then the pages each one came from, then each source.
table(
  ["policy", "directive", "browser"],
  problems.map((p) =>
    [p.disposition === "report" ? "report-only" : "enforced", p.directive, p.browser]
      .map(cell)
      .join(" | ")
  )
);
table(
  ["policy", "directive", "page", "step"],
  problems.map((p) =>
    [p.disposition === "report" ? "report-only" : "enforced", p.directive, p.page, p.step]
      .map(cell)
      .join(" | ")
  )
);
table(
  ["policy", "directive", "blocked", "source (no line)"],
  problems.map((p) =>
    [
      p.disposition === "report" ? "report-only" : "enforced",
      p.directive,
      p.blocked,
      p.source.replace(/:\d+$/, "")
    ]
      .map(cell)
      .join(" | ")
  )
);
for (const note of notes) console.log(`note: ${note}`);
for (const gap of gaps) console.error(`GAP: ${gap}`);
process.exit(counted.length || gaps.length ? 1 : 0);
