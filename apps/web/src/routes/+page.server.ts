import { createApiClient } from "$lib/api.js";
import { resolveApiUrl } from "$lib/env.js";
import { loadHealth } from "$lib/health.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ platform, fetch }) => {
  const client = createApiClient(resolveApiUrl(platform), fetch);

  return { health: await loadHealth(client) };
};
