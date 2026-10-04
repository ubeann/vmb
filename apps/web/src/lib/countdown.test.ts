import { describe, expect, it } from "vitest";
import { formatClock } from "./countdown.svelte.js";

describe("formatClock", () => {
  it.each([
    [60, "1:00"],
    [59, "0:59"],
    [42, "0:42"],
    [9, "0:09"],
    [0, "0:00"],
    [-3, "0:00"],
    [41.9, "0:41"]
  ])("writes %s seconds as %s", (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });
});
