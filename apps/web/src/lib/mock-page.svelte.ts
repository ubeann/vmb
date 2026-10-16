// A stand-in for `$app/state`'s `page` in component tests, reactive as the
// real one is, so a test's `pushState` shows on the page (#302's record layer).
export const mockPage = $state<{ url: URL; state: App.PageState; data: Record<string, unknown> }>({
  url: new URL("http://localhost/"),
  state: {},
  data: {}
});
