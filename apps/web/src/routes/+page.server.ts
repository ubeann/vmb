import { withApiClient } from "$lib/api-access.js";
import { loadHealth, unreachableHealth } from "$lib/health.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
  const access = await withApiClient(event, (client) => loadHealth(client));

  if (!access.ok) {
    console.error("home page load: could not resolve API URL", access.error);
    return { health: unreachableHealth() };
  }

  return { health: access.value };
};
