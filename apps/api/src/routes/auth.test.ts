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
