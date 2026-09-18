import type { ApiClient } from "./api.js";
import { createApiClient } from "./api.js";
import type { AuthApiClient } from "./auth.js";
import { createAuthApiClient } from "./auth.js";
import { resolveApiUrl } from "./env.js";

// The one seam through which server-side code reaches the API (issue #82).
// Callers hand in the request event and the work to run with a ready client,
// so the resolve → build → try/catch wiring lives here once instead of being
// repeated by every hook, page load, and form action.
//
// Two failure paths are owned here: the API URL can't be resolved / the client
// can't be built, and a transport failure while the client is in use. Both are
// reported as a non-throwing `{ ok: false, error }` result; each caller maps
// that to its own user-visible outcome (logged out, unreachable health, or a
// 500 action failure).

// The slice of a SvelteKit request event this seam needs, so it is callable
// from hooks, page loads, and form actions alike.
export interface ApiRequestEvent {
  platform: App.Platform | undefined;
  fetch: typeof fetch;
}

export type ApiAccessResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function withClient<C, T>(
  build: () => C,
  run: (client: C) => Promise<T>
): Promise<ApiAccessResult<T>> {
  let client: C;
  try {
    client = build();
  } catch (error) {
    return { ok: false, error };
  }

  try {
    return { ok: true, value: await run(client) };
  } catch (error) {
    return { ok: false, error };
  }
}

export function withApiClient<T>(
  event: ApiRequestEvent,
  run: (client: ApiClient) => Promise<T>
): Promise<ApiAccessResult<T>> {
  return withClient(() => createApiClient(resolveApiUrl(event.platform), event.fetch), run);
}

export function withAuthApiClient<T>(
  event: ApiRequestEvent,
  run: (client: AuthApiClient) => Promise<T>
): Promise<ApiAccessResult<T>> {
  return withClient(() => createAuthApiClient(resolveApiUrl(event.platform), event.fetch), run);
}
