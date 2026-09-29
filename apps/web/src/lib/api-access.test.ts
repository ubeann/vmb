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

function fakeEvent(fetchFn = vi.fn(), cookie?: string) {
  return {
    platform: undefined,
    request: new Request("https://web.test/page", { headers: cookie ? { cookie } : {} }),
    fetch: fetchFn
  };
}

// The fetch a client was built with, called the way a client calls it; returns
// the request the event's own fetch then received.
async function sendThroughBuiltFetch(
  createMock: typeof createApiClientMock,
  fetchFn: ReturnType<typeof vi.fn>,
  init?: RequestInit
) {
  const builtFetch = createMock.mock.calls.at(-1)?.[1];
  await builtFetch?.("https://api.test/endpoint", init);
  const [input, receivedInit] = fetchFn.mock.calls.at(-1) as [RequestInfo | URL, RequestInit?];
  return new Request(input, receivedInit);
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
    expect(createApiClientMock).toHaveBeenCalledWith("http://localhost:8787", expect.any(Function));
    await sendThroughBuiltFetch(createApiClientMock, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  // The API is on another registrable domain, so SvelteKit's fetch never
  // forwards the browser's cookies there on its own (#226).
  it("forwards the browser's Cookie header to the API", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await withApiClient(fakeEvent(fetchFn, "session=abc"), async () => null);

    const request = await sendThroughBuiltFetch(createApiClientMock, fetchFn);

    expect(request.headers.get("cookie")).toBe("session=abc");
  });

  it("adds no Cookie header when the browser sent none", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await withApiClient(fakeEvent(fetchFn), async () => null);

    const request = await sendThroughBuiltFetch(createApiClientMock, fetchFn);

    expect(request.headers.has("cookie")).toBe(false);
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
    expect(createAuthApiClientMock).toHaveBeenCalledWith(
      "http://localhost:8787",
      expect.any(Function)
    );
    await sendThroughBuiltFetch(createAuthApiClientMock, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("forwards the browser's Cookie header, keeping the request's method, body and headers", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await withAuthApiClient(fakeEvent(fetchFn, "session=abc"), async () => null);

    const request = await sendThroughBuiltFetch(createAuthApiClientMock, fetchFn, {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" }
    });

    expect(request.method).toBe("POST");
    expect(await request.text()).toBe("{}");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("cookie")).toBe("session=abc");
  });

  // SvelteKit reads `mode` and `credentials` off a Request handed to
  // `event.fetch`, which Cloudflare can throw on; a URL and init avoid that.
  it("hands the event's fetch a URL and init, not a Request", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await withAuthApiClient(fakeEvent(fetchFn, "session=abc"), async () => null);

    await sendThroughBuiltFetch(createAuthApiClientMock, fetchFn);

    expect((fetchFn.mock.calls.at(-1) as unknown[] | undefined)?.[0]).toBe(
      "https://api.test/endpoint"
    );
  });

  it("adds no Cookie header when the browser sent none", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await withAuthApiClient(fakeEvent(fetchFn), async () => null);

    const request = await sendThroughBuiltFetch(createAuthApiClientMock, fetchFn);

    expect(request.headers.has("cookie")).toBe(false);
  });

  it("keeps a Cookie header the caller set itself", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await withAuthApiClient(fakeEvent(fetchFn, "session=abc"), async () => null);

    const request = await sendThroughBuiltFetch(createAuthApiClientMock, fetchFn, {
      headers: { cookie: "session=explicit" }
    });

    expect(request.headers.get("cookie")).toBe("session=explicit");
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
