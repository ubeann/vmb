import { describe, expect, it } from "vitest";
import { passwordBarFill, passwordReading, passwordStrength } from "./password-strength.js";

describe("passwordStrength", () => {
  it.each([
    [0, undefined],
    [11, undefined],
    [12, "okay"],
    [15, "okay"],
    [16, "good"],
    [19, "good"],
    [20, "strong"],
    [128, "strong"]
  ])("reads a length of %i as %s", (length, expected) => {
    expect(passwordStrength(length)).toBe(expected);
  });
});

describe("passwordReading", () => {
  it.each([
    [0, "At least 12 characters"],
    [5, "7 more characters"],
    [11, "1 more character"],
    [12, "Length: Okay"],
    [16, "Length: Good"],
    [20, "Length: Strong"]
  ])("reads a length of %i as %s", (length, expected) => {
    expect(passwordReading(length)).toBe(expected);
  });
});

describe("passwordBarFill", () => {
  it("fills in proportion to the length and stops at the full mark", () => {
    expect(passwordBarFill(0)).toBe(0);
    expect(passwordBarFill(10)).toBe(0.5);
    expect(passwordBarFill(20)).toBe(1);
    expect(passwordBarFill(128)).toBe(1);
  });
});
