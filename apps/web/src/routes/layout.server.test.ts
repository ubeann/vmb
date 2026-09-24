import { describe, expect, it } from "vitest";

const { load } = await import("./+layout.server.js");

describe("the app layout", () => {
  it("hands the session user to the layout", () => {
    expect(load({ locals: { user: { id: "user-1" } } } as never)).toEqual({
      user: { id: "user-1" }
    });
  });

  it("reports no user when there is none", () => {
    expect(load({ locals: { user: null } } as never)).toEqual({ user: null });
  });
});
