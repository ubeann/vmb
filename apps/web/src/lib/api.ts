import type { AppType } from "@vmb/api";
import { hc } from "hono/client";

export function createApiClient(baseUrl: string, fetchFn?: typeof fetch) {
  return hc<AppType>(baseUrl, fetchFn ? { fetch: fetchFn } : undefined);
}

export type ApiClient = ReturnType<typeof createApiClient>;
