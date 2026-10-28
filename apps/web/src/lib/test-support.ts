import type { Cookies } from "@sveltejs/kit";

// Shared request-event fixture for the auth action tests. The helper and the
// access seam only read the submitted form, the URL's origin and
// `fetch`, so this builds just those; assembling a full SvelteKit RequestEvent
// would be all noise. `as never` keeps call sites free of casts.
export function fakeAuthEvent(
  fields: Record<string, string> = {},
  { cookies = fakeCookies() } = {}
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);

  return {
    request: new Request("http://localhost/", { method: "POST", body: form }),
    url: new URL("http://localhost/"),
    cookies,
    fetch: () => {
      throw new Error("unexpected fetch");
    }
  } as never;
}

type CookieOptions = Parameters<Cookies["set"]>[2];

// SvelteKit's cookie jar, as far as the auth routes use it: a cookie set or
// deleted is what a later `get` in the same request sees. `options` records
// what each was last set or deleted with.
export function fakeCookies(initial: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initial));
  const options = new Map<string, CookieOptions>();

  return {
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, opts: CookieOptions) => {
      jar.set(name, value);
      options.set(name, opts);
    },
    delete: (name: string, opts: CookieOptions) => {
      jar.delete(name);
      options.set(name, opts);
    },
    options: (name: string) => options.get(name)
  };
}
