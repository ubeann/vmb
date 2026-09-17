export function resolveApiUrl(platform: App.Platform | undefined): string {
  // Per-PR preview deployments bake this PR's own `apps/api` preview URL in at
  // build time (issue #23). It has to take precedence: a Pages Preview
  // environment's API_URL binding is shared across every preview deployment,
  // so it always points at the production API, never this PR's.
  const buildTimeApiUrl = import.meta.env.PUBLIC_API_URL;
  if (buildTimeApiUrl) {
    return buildTimeApiUrl;
  }

  if (!platform) {
    // Local `vite dev` outside the Cloudflare runtime — no platform object at all.
    return "http://localhost:8787";
  }

  const apiUrl = platform.env?.API_URL;
  if (!apiUrl) {
    throw new Error("API_URL is not configured for this deployment (missing Pages binding)");
  }

  return apiUrl;
}
