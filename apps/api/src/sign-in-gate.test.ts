import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { createSignInGate } from "./sign-in-gate.js";

describe("createSignInGate", () => {
  it("admits a session when the business record exists and is not soft-deleted", async () => {
    const gate = createSignInGate(async () => ({ deletedAt: null }));

    await expect(gate({ userId: "user-1" })).resolves.toBeUndefined();
  });

  it("rejects a session when the business record is missing", async () => {
    const gate = createSignInGate(async () => null);

    await expect(gate({ userId: "user-1" })).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: "ACCOUNT_UNAVAILABLE" }
    });
    await expect(gate({ userId: "user-1" })).rejects.toBeInstanceOf(APIError);
  });

  it("rejects a session when the record is soft-deleted", async () => {
    const gate = createSignInGate(async () => ({ deletedAt: "2026-09-01T00:00:00.000Z" }));

    await expect(gate({ userId: "user-1" })).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: "ACCOUNT_UNAVAILABLE" }
    });
  });
});
