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
const { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } = await import("@vmb/types");

function fakeEvent(
  fetchFn = vi.fn(),
  cookie?: string,
  { secret, getClientAddress = () => "203.0.113.5" }: FakeEventOptions = {}
) {
  return {
    platform: secret === undefined ? undefined : { env: { API_URL: "", CLIENT_IP_SECRET: secret } },
    request: new Request("https://web.test/page", { headers: cookie ? { cookie } : {} }),
    fetch: fetchFn,
    getClientAddress
  };
}

interface FakeEventOptions {
  secret?: string;
  getClientAddress?: () => string;
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

// apps/api keys auth rate limits on the browser's address only when the
// shared secret comes with it (#250, ADR-0042). Every API call carries both.
describe.each([
  { name: "withApiClient", access: withApiClient, createMock: createApiClientMock },
  { name: "withAuthApiClient", access: withAuthApiClient, createMock: createAuthApiClientMock }
])("$name client IP", ({ access, createMock }) => {
  it("sends the browser's address and the shared secret", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await access(fakeEvent(fetchFn, "session=abc", { secret: "s3cret" }), async () => null);

    const request = await sendThroughBuiltFetch(createMock, fetchFn);

    expect(request.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.5");
    expect(request.headers.get(CLIENT_IP_SECRET_HEADER)).toBe("s3cret");
    expect(request.headers.get("cookie")).toBe("session=abc");
  });

  it("sends neither header when no secret is configured", async () => {
    const fetchFn = vi.fn(async () => new Response());
    await access(fakeEvent(fetchFn), async () => null);

    const request = await sendThroughBuiltFetch(createMock, fetchFn);

    expect(request.headers.has(CLIENT_IP_HEADER)).toBe(false);
    expect(request.headers.has(CLIENT_IP_SECRET_HEADER)).toBe(false);
  });

  it("still makes the call, without either header, when the browser's address is unknown", async () => {
    const fetchFn = vi.fn(async () => new Response());
    const getClientAddress = () => {
      throw new Error("no address");
    };
    await access(
      fakeEvent(fetchFn, undefined, { secret: "s3cret", getClientAddress }),
      async () => null
    );

    const request = await sendThroughBuiltFetch(createMock, fetchFn);

    expect(request.headers.has(CLIENT_IP_HEADER)).toBe(false);
    expect(request.headers.has(CLIENT_IP_SECRET_HEADER)).toBe(false);
  });
});
