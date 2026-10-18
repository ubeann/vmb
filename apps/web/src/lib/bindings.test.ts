import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// adapter-cloudflare 8 has no `platform`: the Pages bindings reach the server
// through `$app/env/private` (src/env.ts). A PR preview can't catch a mistake
// here, since previews bake in PUBLIC_API_URL, so this test does (#331). Only
// the API clients are faked; the access seam and resolveApiUrl are real.
const bindings = vi.hoisted(() => ({
  API_URL: undefined as string | undefined,
  CLIENT_IP_SECRET: undefined as string | undefined
}));
vi.mock("$app/env/private", () => ({
  get API_URL() {
    return bindings.API_URL;
  },
  get CLIENT_IP_SECRET() {
    return bindings.CLIENT_IP_SECRET;
  }
}));
vi.mock("$app/env", () => ({ dev: false }));

const createApiClientMock = vi.fn((_baseUrl: string, _fetchFn: typeof fetch) => ({}));
vi.mock("./api.js", () => ({
  createApiClient: (baseUrl: string, fetchFn: typeof fetch) => createApiClientMock(baseUrl, fetchFn)
}));

const { withApiClient } = await import("./api-access.js");

function productionEvent(fetchFn: typeof fetch) {
  return {
    request: new Request("https://web.test/page"),
    fetch: fetchFn,
    getClientAddress: () => "203.0.113.5"
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("PUBLIC_API_URL", "");
  createApiClientMock.mockClear();
});

describe("a production build with no PUBLIC_API_URL", () => {
  it("calls the API at the API_URL binding", async () => {
    bindings.API_URL = "https://vmb-api.example.com";

    const result = await withApiClient(productionEvent(vi.fn()), async () => "done");

    expect(result).toEqual({ ok: true, value: "done" });
    expect(createApiClientMock).toHaveBeenCalledWith(
      "https://vmb-api.example.com",
      expect.any(Function)
    );
  });

  it("sends the CLIENT_IP_SECRET binding with the browser's address", async () => {
    bindings.API_URL = "https://vmb-api.example.com";
    bindings.CLIENT_IP_SECRET = "s3cret";
    const fetchFn = vi.fn(async () => new Response());

    await withApiClient(productionEvent(fetchFn), async () => null);
    const builtFetch = createApiClientMock.mock.calls.at(-1)![1];
    await builtFetch("https://vmb-api.example.com/endpoint");
    const [input, init] = fetchFn.mock.calls.at(-1) as unknown as [RequestInfo, RequestInit?];
    const request = new Request(input, init);

    expect(request.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.5");
    expect(request.headers.get(CLIENT_IP_SECRET_HEADER)).toBe("s3cret");
  });

  it("fails the call, rather than reaching localhost, when API_URL is unbound", async () => {
    bindings.API_URL = undefined;

    const result = await withApiClient(productionEvent(vi.fn()), async () => "done");

    expect(result).toMatchObject({
      ok: false,
      error: expect.objectContaining({ message: expect.stringMatching(/API_URL/) })
    });
    expect(createApiClientMock).not.toHaveBeenCalled();
  });
});
