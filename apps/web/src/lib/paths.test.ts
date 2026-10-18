import { describe, expect, it } from "vitest";
import { appPath } from "./paths.js";

describe("appPath", () => {
  it("drops the leading slash, keeping the query", () => {
    expect(appPath("/master/users?role=r1")).toBe("master/users?role=r1");
  });

  it("turns the root into the empty path", () => {
    expect(appPath("/")).toBe("");
  });
});
