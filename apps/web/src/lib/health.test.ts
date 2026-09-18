import { describe, expect, it } from "vitest";
import { loadHealth } from "./health.js";

function fakeClient(get: () => Promise<Response>) {
  return { health: { $get: get } } as unknown as Parameters<typeof loadHealth>[0];
}

describe("loadHealth", () => {
  it("returns the parsed body when the request succeeds", async () => {
    const body = {
      status: "ok" as const,
      db: "connected" as const,
      timestamp: "2026-01-01T00:00:00.000Z"
    };
    const client = fakeClient(async () => new Response(JSON.stringify(body), { status: 200 }));

    await expect(loadHealth(client)).resolves.toEqual(body);
  });

  it("returns an error status when the response is not ok", async () => {
    const client = fakeClient(async () => new Response("", { status: 503 }));

    const result = await loadHealth(client);

    expect(result.status).toBe("error");
    expect(result.db).toBe("unreachable");
  });
});
