import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength.js";

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
