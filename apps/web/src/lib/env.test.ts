import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveApiUrl } from "./env.js";

const productionApiUrl = "https://vmb-api.example.com";
const previewApiUrl = "https://pr-23-vmb-api.example.workers.dev";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveApiUrl", () => {
  it("falls back to localhost when there is no platform object (local `vite dev`)", () => {
    expect(resolveApiUrl(undefined)).toBe("http://localhost:8787");
  });

  it("returns the configured API_URL when the platform binding is present", () => {
    expect(resolveApiUrl({ env: { API_URL: productionApiUrl } })).toBe(productionApiUrl);
  });

  it("throws instead of silently falling back when deployed but API_URL is missing", () => {
    expect(() => resolveApiUrl({ env: { API_URL: "" } })).toThrow(/API_URL/);
  });

  it("prefers the build-time PUBLIC_API_URL over the platform binding (per-PR previews)", () => {
    vi.stubEnv("PUBLIC_API_URL", previewApiUrl);

    expect(resolveApiUrl({ env: { API_URL: productionApiUrl } })).toBe(previewApiUrl);
  });

  it("uses the build-time PUBLIC_API_URL even without a platform object", () => {
    vi.stubEnv("PUBLIC_API_URL", previewApiUrl);

    expect(resolveApiUrl(undefined)).toBe(previewApiUrl);
  });
});
