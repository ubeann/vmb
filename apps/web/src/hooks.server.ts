import { withAuthApiClient } from "$lib/api-access.js";
import { isPublicRoute } from "$lib/public-routes.js";
import { withSecurityHeaders } from "$lib/server/security-headers.js";
import { loadSession } from "$lib/session.js";
import { redirect } from "@sveltejs/kit";
import type { Handle, HandleServerError } from "@sveltejs/kit/hooks";

// The two faces the first screen paints with (ADR-0046): the UI face and the
// display headings' optical-size cut. The browser only discovers them after it
// has read the stylesheet, so the largest paint waits on that round trip; a
// preload link starts both downloads with the page. Only the `latin` subsets:
// the `latin-ext` files are fetched only when a page uses those characters, and
// preloading them would spend bandwidth on every load. The mono face is left to
// the pages that show codes.
const PRELOADED_FONT =
  /\/(?:schibsted-grotesk-latin-wght|newsreader-latin-opsz)-normal\.[^/]+\.woff2$/;

export const handle: Handle = async ({ event, resolve }) => {
  // CSP reports are public and need no user, so they skip the session lookup:
  // otherwise each anonymous report would cost a vmb-api call (ADR-0047).
  if (event.url.pathname === "/csp-report") {
    event.locals.session = null;
    event.locals.user = null;
    return withSecurityHeaders(await resolve(event));
  }

  // withAuthApiClient owns URL resolution and the transport-failure path, but
  // this hook runs on every request — a config mistake or an API outage should
  // degrade to "logged out" instead of taking the whole site down.
  const access = await withAuthApiClient(event, (client) =>
    loadSession(client, event.request.headers.get("cookie"))
  );

  if (access.ok) {
    event.locals.session = access.value.session;
    event.locals.user = access.value.user;
  } else {
    console.error("handle: failed to load session", access.error);
    event.locals.session = null;
    event.locals.user = null;
  }

  // #7's web gate, before routing: an unauthenticated request never reaches a
  // page load or a form action. `event.route.id` is null for non-route requests
  // (static assets, unmatched paths), which this leaves alone.
  if (!event.locals.user && event.route.id !== null && !isPublicRoute(event.url.pathname)) {
    redirect(303, "/login");
  }

  // The gate's thrown 303 above skips this: a bodiless redirect needs none of
  // these headers, and /login sets HSTS on the very next response (ADR-0047).
  return withSecurityHeaders(
    await resolve(event, {
      preload: ({ type, path }) => type === "font" && PRELOADED_FONT.test(path)
    })
  );
};

// An unexpected failure gets a short reference and its time, logged with the
// error and shown on the error page, so a support email can be matched to its
// log line. Kit 3 calls this for every error, not only unexpected ones (#331):
// an `error(...)` the app threw on purpose keeps its own status and message,
// and a missing page or any other error SvelteKit raises itself is no failure.
// None of those get a reference. What is returned is merged over SvelteKit's
// default `{ status, message }`, which for an unknown error is 500 and
// "Internal Error".
export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== "unknown") return;

  const errorId = crypto.randomUUID().slice(0, 8);
  const occurredAt = new Date().toISOString();
  console.error(
    `handleError: ${errorId} ${occurredAt} ${event.request.method} ${event.url.pathname}`,
    error
  );
  return { errorId, occurredAt };
};
