import { createAuthClient } from "better-auth/svelte";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";

// Server-only: forwards Set-Cookie from the API's responses onto the actual
// SvelteKit response (needed for cookies set inside form actions/hooks,
// which call the API directly rather than through the browser).
export function createAuthApiClient(baseUrl: string, fetchFn?: typeof fetch) {
  return createAuthClient({
    baseURL: baseUrl,
    fetchOptions: fetchFn ? { customFetchImpl: fetchFn } : undefined,
    plugins: [sveltekitCookies(getRequestEvent)]
  });
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>;

type SessionData = NonNullable<Awaited<ReturnType<AuthApiClient["getSession"]>>["data"]>;

export type AuthSession = SessionData["session"];
export type AuthUser = SessionData["user"];
