import type { HealthResponse } from "@vmb/types";
import type { ApiClient } from "./api.js";

export function unreachableHealth(): HealthResponse {
  return { status: "error", db: "unreachable", timestamp: new Date().toISOString() };
}

// A thrown transport failure propagates to the API access seam (issue #82);
// only a reachable API answering with a non-2xx is mapped here.
export async function loadHealth(client: ApiClient): Promise<HealthResponse> {
  const res = await client.health.$get();
  return res.ok ? await res.json() : unreachableHealth();
}
