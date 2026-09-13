import { createApiClient } from "$lib/api.js";
import { loadHealth } from "$lib/health.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ platform, fetch }) => {
  const apiUrl = platform?.env?.API_URL ?? "http://localhost:8787";
  const client = createApiClient(apiUrl, fetch);

  return { health: await loadHealth(client) };
};
