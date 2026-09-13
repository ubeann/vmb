import type { HealthResponse } from "@vmb/types";
import type { createApiClient } from "./api.js";

function unreachable(): HealthResponse {
  return { status: "error", db: "unreachable", timestamp: new Date().toISOString() };
}

export async function loadHealth(client: ReturnType<typeof createApiClient>): Promise<HealthResponse> {
  try {
    const res = await client.health.$get();
    return res.ok ? await res.json() : unreachable();
  } catch (err) {
    console.error("loadHealth: request to API failed", err);
    return unreachable();
  }
}
