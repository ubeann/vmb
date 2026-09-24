import { createAuthClient } from "better-auth/svelte";
import { emailOTPClient } from "better-auth/client/plugins";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies/utils";
import { getRequestEvent } from "$app/server";

// Server-only: forwards Set-Cookie from the API's responses onto the actual
// SvelteKit response (needed for cookies set inside form actions/hooks, which
// call the API directly rather than through the browser).
//
// better-auth ships a `sveltekitCookies` plugin for exactly this, but it's a
// *server* plugin (registers `hooks.after`, meant for `betterAuth({ plugins })`
// when Better Auth is mounted inside the SvelteKit app itself). A client built
// with `createAuthClient` only ever reads `plugin.fetchPlugins` — see
// `getClientConfig` in better-auth's `client/config.ts` — so `sveltekitCookies`'s
// `hooks.after` is silently never invoked here, and no session survives
// sign-in. Forward the cookie ourselves through the hook the client does run,
// `fetchOptions.onResponse`, reusing the same parsing better-auth's own plugin
// uses. The email-OTP client adds the activation endpoints (#7, ADR-0033).
export function createAuthApiClient(baseUrl: string, fetchFn?: typeof fetch) {
  return createAuthClient({
    baseURL: baseUrl,
    fetchOptions: {
      ...(fetchFn ? { customFetchImpl: fetchFn } : {}),
      onResponse({ response }) {
        const setCookies =
          typeof response.headers.getSetCookie === "function"
            ? response.headers.getSetCookie()
            : [response.headers.get("set-cookie")].filter((value) => value !== null);

        if (setCookies.length === 0) return;

        const event = getRequestEvent();
        for (const setCookie of setCookies) {
          for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
            event.cookies.set(name, attributes.value, {
              ...toCookieOptions(attributes),
              path: attributes.path || "/"
            });
          }
        }
      }
    },
    plugins: [emailOTPClient()]
  });
}

export type AuthApiClient = ReturnType<typeof createAuthApiClient>;

type SessionData = NonNullable<Awaited<ReturnType<AuthApiClient["getSession"]>>["data"]>;

export type AuthSession = SessionData["session"];
export type AuthUser = SessionData["user"];
