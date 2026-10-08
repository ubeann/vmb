// The review viewports and the page states the page-check scripts can open
// (docs/agents/page-checks.md). A state is a page as a user reaches it partway
// through a flow, such as /activate's code step after "Send code", opened
// without going through the flow: the step cookies the server reads are set
// directly, and a form's reply is stubbed when the state needs one. Works on
// local dev and on a PR preview; the server checks the cookies only when a
// form is sent.

import { URL } from "node:url";

/** design-workflow.md's review viewports, [width, height]. */
export const VIEWPORTS = [
  [2560, 1440],
  [1920, 1080],
  [1680, 1000],
  [1440, 900],
  [1366, 768],
  [1024, 923],
  [390, 844]
];

const EMAIL = "preview@vmblogistics.id";

// SvelteKit's reply to an enhanced form: `data` is devalue's flat-array form.
const actionReply = (step) =>
  JSON.stringify({
    type: "success",
    status: 200,
    data: JSON.stringify([{ step: 1, email: 2 }, step, EMAIL])
  });

/**
 * @typedef {{
 *   path: string,
 *   cookies?: () => Record<string, unknown>,
 *   stub?: { action: string, step: string, cookies?: () => Record<string, unknown> },
 *   prepare?: (page: import("playwright").Page) => Promise<void>
 * }} PageState
 */

/** @type {Record<string, PageState>} */
export const STATES = {
  // Submitted empty: both fields marked invalid, with their messages.
  "login:errors": {
    path: "/login",
    prepare: (page) => page.getByRole("button", { name: "Log in" }).click()
  },
  // The code step, just after "Send code": the resend wait running.
  "activate:code": {
    path: "/activate",
    cookies: () => ({ vmb_activate_sent: { email: EMAIL, sentAt: Date.now() } })
  },
  // The code step after "Send a new code" worked: the new send time and a fresh wait.
  "activate:resent": {
    path: "/activate",
    cookies: () => ({ vmb_activate_sent: { email: EMAIL, sentAt: Date.now() - 61_000 } }),
    stub: {
      action: "resend",
      step: "code",
      cookies: () => ({ vmb_activate_sent: { email: EMAIL, sentAt: Date.now() } })
    },
    prepare: (page) => page.getByRole("button", { name: "Send a new code" }).click()
  },
  // The password step with a passphrase typed: the length reading and the advice.
  "activate:password": {
    path: "/activate",
    cookies: () => ({ vmb_activate: { email: EMAIL, otp: "000000" } }),
    prepare: (page) => page.locator("#new-password").fill("crate yard ledger")
  },
  // The password step with a word from the email typed: the warning in the advice's place.
  "activate:password-warning": {
    path: "/activate",
    cookies: () => ({ vmb_activate: { email: EMAIL, otp: "000000" } }),
    prepare: (page) => page.locator("#new-password").fill("my preview crate yard")
  }
};

/** The value after `name` in a script's flags, or undefined. */
export function option(flags, name) {
  const index = flags.indexOf(name);
  return index === -1 ? undefined : flags[index + 1];
}

/** Exits with the known state names when `name` isn't one. */
export function stateOrExit(name) {
  if (name === undefined) return undefined;
  if (STATES[name]) return STATES[name];
  console.error(`unknown state: ${name}. Known: ${Object.keys(STATES).join(", ")}`);
  process.exit(1);
}

function cookiesFor(origin, values) {
  const { hostname, protocol } = new URL(origin);
  return Object.entries(values).map(([name, value]) => ({
    name,
    value: JSON.stringify(value),
    domain: hostname,
    path: "/activate",
    sameSite: "Strict",
    secure: protocol === "https:"
  }));
}

/**
 * Opens `url`, or the state's page on `url`'s origin, in a new page of
 * `context`, and brings it to the state. Waits for the network to settle and
 * then `wait` ms, so one-shot entrance motion has finished.
 *
 * @param {import("playwright").BrowserContext} context
 * @param {string} url
 * @param {PageState | undefined} state
 * @param {number} [wait]
 */
export async function openPage(context, url, state, wait = 0) {
  const target = state ? new URL(state.path, url).href : url;
  const origin = new URL(target).origin;
  if (state?.cookies) await context.addCookies(cookiesFor(origin, state.cookies()));
  const page = await context.newPage();
  if (state?.stub) {
    const { action, step, cookies } = state.stub;
    await page.route(new RegExp(`\\?/${action}$`), async (route) => {
      if (cookies) await context.addCookies(cookiesFor(origin, cookies()));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: actionReply(step)
      });
    });
  }
  await page.goto(target, { waitUntil: "networkidle" });
  if (wait) await page.waitForTimeout(wait);
  if (state?.prepare) {
    await state.prepare(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
  }
  return page;
}

/** Puts `page` in `scheme` the way the app does: the `.dark` class on <html>. */
export async function setScheme(page, scheme) {
  await page.evaluate(
    (dark) => document.documentElement.classList.toggle("dark", dark),
    scheme === "dark"
  );
  await page.waitForTimeout(300);
}
