import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, withSecurityHeaders } from "./security-headers.js";

describe("withSecurityHeaders (ADR-0047)", () => {
  it("adds every security header to a plain response", () => {
    const res = withSecurityHeaders(new Response("ok"));

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it("keeps a header the endpoint already chose", () => {
    const res = withSecurityHeaders(
      new Response("ok", { headers: { "x-frame-options": "SAMEORIGIN" } })
    );

    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("copies a response whose headers are immutable", async () => {
    const redirect = Response.redirect("https://vmb.example/login", 303);

    const res = withSecurityHeaders(redirect);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://vmb.example/login");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
