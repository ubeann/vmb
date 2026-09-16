import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "./env.js";

describe("resolveApiUrl", () => {
  it("falls back to localhost when there is no platform object (local `vite dev`)", () => {
    expect(resolveApiUrl(undefined)).toBe("http://localhost:8787");
  });

  it("returns the configured API_URL when the platform binding is present", () => {
    expect(resolveApiUrl({ env: { API_URL: "https://vmb-api.example.com" } })).toBe("https://vmb-api.example.com");
  });

  it("throws instead of silently falling back when deployed but API_URL is missing", () => {
    expect(() => resolveApiUrl({ env: { API_URL: "" } })).toThrow(/API_URL/);
  });
});
