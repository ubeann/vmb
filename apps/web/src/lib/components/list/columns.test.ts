import { describe, expect, it } from "vitest";
import { columnClass, TEXT_CAP } from "./columns.js";

describe("the list column rule (ADR-0050)", () => {
  it("shrinks a utility column to its content", () => {
    expect(columnClass("utility")).toBe("w-px whitespace-nowrap");
  });

  it("gives the identity and free-text columns no width of their own, so they share the rest", () => {
    expect(columnClass("identity")).not.toMatch(/\bw-/);
    expect(columnClass("text")).not.toMatch(/\bw-/);
  });

  it("caps free text at about 48ch and truncates it", () => {
    expect(TEXT_CAP).toBe("block max-w-[48ch] truncate");
  });
});
