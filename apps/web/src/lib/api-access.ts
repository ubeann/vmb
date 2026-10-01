import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";
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
// It also forwards the browser's Cookie header on every API call. SvelteKit's
// `event.fetch` only does that for the app's own host and its subdomains, and
// apps/api is on another registrable domain (ADR-0034), so without it the API
// sees no session at all (#226). With it go the browser's address and the
// shared secret that lets apps/api trust it, so auth rate limits count per
// browser rather than per apps/web (#250, ADR-0042).
//
// Both failure paths are owned here: the API URL can't be resolved / the
// client can't be built, and a transport failure while the client is in use.
// The work a caller passes in must let transport failures propagate rather
// than swallowing them, or this seam cannot see them. Both are reported as a
// non-throwing `{ ok: false, error }` result; each caller maps that to its own
// user-visible outcome (logged out, unreachable health, or a 500 action
// failure).

// The slice of a SvelteKit request event this seam needs, so it is callable
// from hooks, page loads, and form actions alike.
export interface ApiRequestEvent {
  platform: App.Platform | undefined;
  fetch: typeof fetch;
  request: Request;
  getClientAddress: () => string;
}

export type ApiAccessResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function withClient<C, T>(
  build: () => C,
  run: (client: C) => Promise<T>
): Promise<ApiAccessResult<T>> {
  try {
    return { ok: true, value: await run(build()) };
  } catch (error) {
    return { ok: false, error };
  }
}

// The event's fetch, with the browser's Cookie header added unless the caller
// set one, and the browser's address with the shared secret when one is set. Better Auth refuses a cookie-carrying POST without a trusted Origin;
// `event.fetch` already sends apps/web's own origin, which apps/api trusts
// (`trustedOrigins: [WEB_URL]`). The call stays `(input, init)` rather than a
// Request, since SvelteKit reads `mode` off a Request and Cloudflare can throw.
function forwardingBrowser(event: ApiRequestEvent): typeof fetch {
  const cookie = event.request.headers.get("cookie");
  const clientIp = trustedClientIp(event);
  if (!cookie && !clientIp) return event.fetch;

  return (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);
    if (clientIp) {
      headers.set(CLIENT_IP_HEADER, clientIp.address);
      headers.set(CLIENT_IP_SECRET_HEADER, clientIp.secret);
    }
    return event.fetch(input, { ...init, headers });
  };
}

// Nothing to send without the secret, since apps/api would not trust the
// address. `getClientAddress` can throw where SvelteKit has no address to
// give; the call then goes without, and apps/api uses `cf-connecting-ip`.
function trustedClientIp(event: ApiRequestEvent): { address: string; secret: string } | null {
  const secret = event.platform?.env.CLIENT_IP_SECRET;
  if (!secret) return null;

  try {
    return { address: event.getClientAddress(), secret };
  } catch {
    return null;
  }
}

export function withApiClient<T>(
  event: ApiRequestEvent,
  run: (client: ApiClient) => Promise<T>
): Promise<ApiAccessResult<T>> {
  return withClient(
    () => createApiClient(resolveApiUrl(event.platform), forwardingBrowser(event)),
    run
  );
}

export function withAuthApiClient<T>(
  event: ApiRequestEvent,
  run: (client: AuthApiClient) => Promise<T>
): Promise<ApiAccessResult<T>> {
  return withClient(
    () => createAuthApiClient(resolveApiUrl(event.platform), forwardingBrowser(event)),
    run
  );
}
