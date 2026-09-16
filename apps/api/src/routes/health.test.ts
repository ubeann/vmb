import { describe, expect, it, vi } from "vitest";

const executeMock = vi.fn();
const createDbMock = vi.fn((_databaseUrl: string) => ({ execute: executeMock }));

vi.mock("@vmb/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vmb/db")>()),
  createDb: (databaseUrl: string) => createDbMock(databaseUrl)
}));

const { default: app } = await import("../index.js");

describe("GET /health", () => {
  it("returns 200 with status ok when the db query succeeds", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const res = await app.request("/health", {}, { DATABASE_URL: "postgres://test" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "ok", db: "connected" });
  });

  it("returns 503 with status error when the db query fails", async () => {
    executeMock.mockRejectedValueOnce(new Error("connection refused"));

    const res = await app.request("/health", {}, { DATABASE_URL: "postgres://test" });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ status: "error", db: "unreachable" });
  });

  it("returns 503 with status error when createDb throws synchronously", async () => {
    createDbMock.mockImplementationOnce(() => {
      throw new Error("invalid connection string");
    });

    const res = await app.request("/health", {}, { DATABASE_URL: "" });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ status: "error", db: "unreachable" });
  });
});
