// `apiUrl` is the API_URL Pages binding, read through `$app/env/private`
// (src/env.ts); `dev` is `$app/env`'s. Both are passed in so this stays a pure
// function the node-environment unit tests can call.
export function resolveApiUrl(apiUrl: string | undefined, { dev }: { dev: boolean }): string {
  // Per-PR preview deployments bake this PR's own `apps/api` preview URL in at
  // build time (issue #23). It has to take precedence: a Pages Preview
  // environment's API_URL binding is shared across every preview deployment,
  // so it always points at the production API, never this PR's.
  const buildTimeApiUrl = import.meta.env.PUBLIC_API_URL;
  if (buildTimeApiUrl) {
    return buildTimeApiUrl;
  }

  if (apiUrl) {
    return apiUrl;
  }

  if (dev) {
    // Local `vite dev` with no API_URL in `.dev.vars`: the API's own dev server.
    return "http://localhost:8787";
  }

  throw new Error("API_URL is not configured for this deployment (missing Pages binding)");
}
