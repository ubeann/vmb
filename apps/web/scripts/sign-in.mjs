// Signs a Playwright browser context in through the real /login form, for the
// page-check scripts that need a signed-in page (docs/agents/page-checks.md).
//
// Defaults to the seeded preview user (packages/db/src/seed/data/master.ts),
// which exists on every PR preview and on a local branch after `db:seed`, never
// on production. VMB_LOGIN_EMAIL and VMB_LOGIN_PASSWORD override it.

import { URL } from "node:url";

export const LOGIN_EMAIL = process.env.VMB_LOGIN_EMAIL ?? "preview@vmblogistics.id";
export const LOGIN_PASSWORD = process.env.VMB_LOGIN_PASSWORD ?? "preview-password";

/**
 * Signs `context` in at `origin` and returns its session cookies for `origin`.
 * Throws with the form's own error when the sign-in is refused.
 *
 * @param {import("playwright").BrowserContext} context
 * @param {string} origin
 */
export async function signIn(context, origin) {
  const page = await context.newPage();
  await page.goto(new URL("/login", origin).href);
  // The form submits through `enhance`, so fill it only once it has hydrated.
  await page.waitForLoadState("networkidle");
  await page.fill("#email", LOGIN_EMAIL);
  await page.fill("#password", LOGIN_PASSWORD);
  await page.click("button[type=submit]");
  const left = await page
    .waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!left) {
    const alert = await page
      .locator('[role="alert"]')
      .allTextContents()
      .catch(() => []);
    await page.close();
    throw new Error(
      `sign-in as ${LOGIN_EMAIL} at ${origin} failed: ${alert.join(" ").trim() || "still on /login"}`
    );
  }
  await page.close();
  return context.cookies(origin);
}

/** True when `url` is the login page, i.e. a signed-in page bounced the request. */
export function isLoginPage(url) {
  return new URL(url).pathname.startsWith("/login");
}
