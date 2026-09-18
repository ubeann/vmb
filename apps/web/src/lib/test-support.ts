// Shared request-event fixture for the auth action tests. The helper and the
// access seam only read the submitted form, the URL's origin, `platform`, and
// `fetch`, so this builds just those; assembling a full SvelteKit RequestEvent
// would be all noise. `as never` keeps call sites free of casts.
export function fakeAuthEvent(fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);

  return {
    request: new Request("http://localhost/", { method: "POST", body: form }),
    url: new URL("http://localhost/"),
    platform: undefined,
    fetch: () => {
      throw new Error("unexpected fetch");
    }
  } as never;
}
