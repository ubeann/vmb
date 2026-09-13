import { createAuthApiClient } from "$lib/auth.js";
import { resolveApiUrl } from "$lib/env.js";
import { loadSession } from "$lib/session.js";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const client = createAuthApiClient(resolveApiUrl(event.platform), event.fetch);

  const { session, user } = await loadSession(client, event.request.headers.get("cookie"));
  event.locals.session = session;
  event.locals.user = user;

  return resolve(event);
};
