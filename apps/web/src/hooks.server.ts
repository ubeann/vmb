import { withAuthApiClient } from "$lib/api-access.js";
import { isPublicRoute } from "$lib/public-routes.js";
import { loadSession } from "$lib/session.js";
import { redirect, type Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
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

  return resolve(event);
};
