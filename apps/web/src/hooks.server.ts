import { createAuthApiClient } from "$lib/auth.js";
import { resolveApiUrl } from "$lib/env.js";
import { loadSession } from "$lib/session.js";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // resolveApiUrl throws on a misconfigured deployment (missing API_URL
  // binding) rather than silently defaulting — but this hook runs on every
  // request, so a config mistake should degrade to "logged out" instead of
  // taking the whole site down.
  try {
    const client = createAuthApiClient(resolveApiUrl(event.platform), event.fetch);
    const { session, user } = await loadSession(client, event.request.headers.get("cookie"));
    event.locals.session = session;
    event.locals.user = user;
  } catch (err) {
    console.error("handle: failed to resolve session", err);
    event.locals.session = null;
    event.locals.user = null;
  }

  return resolve(event);
};
