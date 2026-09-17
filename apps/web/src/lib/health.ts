import type { HealthResponse } from "@vmb/types";
import type { createApiClient } from "./api.js";

export function unreachableHealth(): HealthResponse {
  return { status: "error", db: "unreachable", timestamp: new Date().toISOString() };
}

export async function loadHealth(
  client: ReturnType<typeof createApiClient>
): Promise<HealthResponse> {
  try {
    const res = await client.health.$get();
    return res.ok ? await res.json() : unreachableHealth();
  } catch (err) {
    console.error("loadHealth: request to API failed", err);
    return unreachableHealth();
  }
}
