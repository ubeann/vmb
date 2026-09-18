import { beforeEach, describe, expect, it, vi } from "vitest";

const createApiClientMock = vi.fn((baseUrl: string, fetchFn?: typeof fetch): unknown => ({
  kind: "api",
  baseUrl,
  fetchFn
}));
const createAuthApiClientMock = vi.fn((baseUrl: string, fetchFn?: typeof fetch): unknown => ({
  kind: "auth",
  baseUrl,
  fetchFn
}));
const resolveApiUrlMock = vi.fn((_platform: unknown) => "http://localhost:8787");

vi.mock("./api.js", () => ({
  createApiClient: (baseUrl: string, fetchFn?: typeof fetch) =>
    createApiClientMock(baseUrl, fetchFn)
}));

vi.mock("./auth.js", () => ({
  createAuthApiClient: (baseUrl: string, fetchFn?: typeof fetch) =>
    createAuthApiClientMock(baseUrl, fetchFn)
}));

vi.mock("./env.js", () => ({
  resolveApiUrl: (platform: unknown) => resolveApiUrlMock(platform)
}));

const { withApiClient, withAuthApiClient } = await import("./api-access.js");

function fakeEvent(fetchFn = vi.fn()) {
  return { platform: undefined, fetch: fetchFn };
}

beforeEach(() => {
  createApiClientMock.mockClear();
  createAuthApiClientMock.mockClear();
  resolveApiUrlMock.mockClear();
  resolveApiUrlMock.mockImplementation(() => "http://localhost:8787");
});

describe("withApiClient", () => {
  it("resolves the URL, builds a client with the event's fetch, and runs the callback against it", async () => {
    const fetchFn = vi.fn();
    const event = fakeEvent(fetchFn);
    const client = { kind: "api" };
    createApiClientMock.mockReturnValueOnce(client);

    const run = vi.fn(async (c: unknown) => {
      expect(c).toBe(client);
      return "value";
    });

    await expect(withApiClient(event, run)).resolves.toEqual({ ok: true, value: "value" });
    expect(createApiClientMock).toHaveBeenCalledWith("http://localhost:8787", fetchFn);
  });

  it("returns an error result without running the callback when the API URL can't be resolved", async () => {
    resolveApiUrlMock.mockImplementationOnce(() => {
      throw new Error("API_URL is not configured for this deployment");
    });

    const run = vi.fn();
    const result = await withApiClient(fakeEvent(), run);

    expect(result.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("owns a transport failure: a rejecting request becomes an error result instead of throwing", async () => {
    const error = new Error("network down");

    const result = await withApiClient(fakeEvent(), async () => {
      throw error;
    });

    expect(result).toEqual({ ok: false, error });
  });
});

describe("withAuthApiClient", () => {
  it("resolves the URL, builds a client with the event's fetch, and runs the callback against it", async () => {
    const fetchFn = vi.fn();
    const event = fakeEvent(fetchFn);
    const client = { kind: "auth" };
    createAuthApiClientMock.mockReturnValueOnce(client);

    const run = vi.fn(async (c: unknown) => {
      expect(c).toBe(client);
      return "value";
    });

    await expect(withAuthApiClient(event, run)).resolves.toEqual({ ok: true, value: "value" });
    expect(createAuthApiClientMock).toHaveBeenCalledWith("http://localhost:8787", fetchFn);
  });

  it("returns an error result without running the callback when the API URL can't be resolved", async () => {
    resolveApiUrlMock.mockImplementationOnce(() => {
      throw new Error("API_URL is not configured for this deployment");
    });

    const run = vi.fn();
    const result = await withAuthApiClient(fakeEvent(), run);

    expect(result.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("owns a transport failure: a rejecting request becomes an error result instead of throwing", async () => {
    const error = new Error("network down");

    const result = await withAuthApiClient(fakeEvent(), async () => {
      throw error;
    });

    expect(result).toEqual({ ok: false, error });
  });
});
