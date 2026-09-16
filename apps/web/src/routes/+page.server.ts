import { createApiClient } from "$lib/api.js";
import { resolveApiUrl } from "$lib/env.js";
import { loadHealth, unreachableHealth } from "$lib/health.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ platform, fetch }) => {
  let apiUrl: string;
  try {
    apiUrl = resolveApiUrl(platform);
  } catch (err) {
    console.error("home page load: could not resolve API URL", err);
    return { health: unreachableHealth() };
  }

  const client = createApiClient(apiUrl, fetch);
  return { health: await loadHealth(client) };
};
