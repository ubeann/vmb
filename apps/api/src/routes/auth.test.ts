import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER } from "@vmb/types";
import { describe, expect, it, vi } from "vitest";

const handlerMock = vi.fn();
const createAuthMock = vi.fn((_env: unknown) => ({ handler: handlerMock }));

vi.mock("../auth.js", () => ({
  createAuth: (env: unknown) => createAuthMock(env)
}));

const { default: app } = await import("../index.js");

const bindings = {
  DATABASE_URL: "postgres://test",
  BETTER_AUTH_SECRET: "secret",
  BETTER_AUTH_URL: "http://localhost:8787",
  WEB_URL: "http://localhost:5173",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "onboarding@resend.dev"
};

describe("ALL /api/auth/*", () => {
  it("delegates the raw request to the Better Auth handler", async () => {
    handlerMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const res = await app.request("/api/auth/get-session", {}, bindings);

    expect(res.status).toBe(200);
    expect(createAuthMock).toHaveBeenCalledWith(bindings);
    expect(handlerMock).toHaveBeenCalledTimes(1);
    const forwardedRequest = handlerMock.mock.calls[0]?.[0] as Request;
    expect(forwardedRequest.url).toContain("/api/auth/get-session");
  });

  it("responds to a CORS preflight from the configured web origin with credentials allowed", async () => {
    const res = await app.request(
      "/api/auth/sign-in/email",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST"
        }
      },
      bindings
    );

    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  // Better Auth keys its rate limits on the address the forwarded request
  // carries (ADR-0042). Only apps/web, holding the secret, may name it.
  describe("client IP", () => {
    const withSecret = { ...bindings, CLIENT_IP_SECRET: "s3cret" };

    async function forwardedHeaders(headers: Record<string, string>, env: object = withSecret) {
      handlerMock.mockClear();
      handlerMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
      await app.request("/api/auth/sign-in/email", { method: "POST", headers }, env);
      return (handlerMock.mock.calls[0]?.[0] as Request).headers;
    }

    it("trusts apps/web's client-IP header when the secret matches", async () => {
      const headers = await forwardedHeaders({
        "cf-connecting-ip": "198.51.100.7",
        [CLIENT_IP_HEADER]: "203.0.113.5",
        [CLIENT_IP_SECRET_HEADER]: "s3cret"
      });

      expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.5");
    });

    it("keys on cf-connecting-ip when the header comes without the secret", async () => {
      const headers = await forwardedHeaders({
        "cf-connecting-ip": "198.51.100.7",
        [CLIENT_IP_HEADER]: "203.0.113.5"
      });

      expect(headers.get(CLIENT_IP_HEADER)).toBe("198.51.100.7");
    });

    it("keys on cf-connecting-ip when the secret is wrong", async () => {
      const headers = await forwardedHeaders({
        "cf-connecting-ip": "198.51.100.7",
        [CLIENT_IP_HEADER]: "203.0.113.5",
        [CLIENT_IP_SECRET_HEADER]: "guess"
      });

      expect(headers.get(CLIENT_IP_HEADER)).toBe("198.51.100.7");
    });

    it("trusts nothing when apps/api has no secret set, even an empty one sent", async () => {
      const headers = await forwardedHeaders(
        {
          "cf-connecting-ip": "198.51.100.7",
          [CLIENT_IP_HEADER]: "203.0.113.5",
          [CLIENT_IP_SECRET_HEADER]: ""
        },
        bindings
      );

      expect(headers.get(CLIENT_IP_HEADER)).toBe("198.51.100.7");
    });

    it("sends no client IP when there is neither a trusted header nor cf-connecting-ip", async () => {
      const headers = await forwardedHeaders({ [CLIENT_IP_HEADER]: "203.0.113.5" });

      expect(headers.has(CLIENT_IP_HEADER)).toBe(false);
    });

    it("never hands the secret on to Better Auth", async () => {
      const headers = await forwardedHeaders({
        [CLIENT_IP_HEADER]: "203.0.113.5",
        [CLIENT_IP_SECRET_HEADER]: "s3cret"
      });

      expect(headers.has(CLIENT_IP_SECRET_HEADER)).toBe(false);
    });
  });

  it("does not allow a different origin", async () => {
    const res = await app.request(
      "/api/auth/sign-in/email",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://evil.example",
          "Access-Control-Request-Method": "POST"
        }
      },
      bindings
    );

    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
