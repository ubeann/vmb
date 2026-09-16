export function resolveApiUrl(platform: App.Platform | undefined): string {
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
