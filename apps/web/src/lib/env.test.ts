import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveApiUrl } from "./env.js";

const productionApiUrl = "https://vmb-api.example.com";
const previewApiUrl = "https://pr-23-vmb-api.example.workers.dev";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveApiUrl", () => {
  it("falls back to localhost under `vite dev` when no API_URL binding is set", () => {
    expect(resolveApiUrl(undefined, { dev: true })).toBe("http://localhost:8787");
  });

  it("returns the API_URL binding", () => {
    expect(resolveApiUrl(productionApiUrl, { dev: false })).toBe(productionApiUrl);
  });

  it("uses an API_URL binding under `vite dev` too", () => {
    expect(resolveApiUrl(productionApiUrl, { dev: true })).toBe(productionApiUrl);
  });

  it("throws instead of silently falling back when deployed but API_URL is missing", () => {
    expect(() => resolveApiUrl(undefined, { dev: false })).toThrow(/API_URL/);
  });

  it("prefers the build-time PUBLIC_API_URL over the binding (per-PR previews)", () => {
    vi.stubEnv("PUBLIC_API_URL", previewApiUrl);

    expect(resolveApiUrl(productionApiUrl, { dev: false })).toBe(previewApiUrl);
  });

  it("uses the build-time PUBLIC_API_URL even without a binding", () => {
    vi.stubEnv("PUBLIC_API_URL", previewApiUrl);

    expect(resolveApiUrl(undefined, { dev: false })).toBe(previewApiUrl);
  });
});
