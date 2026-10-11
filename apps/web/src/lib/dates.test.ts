import { describe, expect, it } from "vitest";
import { formatAbsolute, formatDay, formatRelative } from "./dates.js";

const iso = "2026-10-05T03:04:00.000Z";

describe("formatAbsolute", () => {
  it("writes the date and time in the given timezone", () => {
    expect(formatAbsolute(iso, "Asia/Jakarta")).toBe("5 Oct 2026, 10:04");
    expect(formatAbsolute(iso, "UTC")).toBe("5 Oct 2026, 03:04");
  });
});

describe("formatDay", () => {
  it("keeps the day and drops the time, in the given timezone", () => {
    expect(formatDay(iso, "UTC")).toBe("5 Oct 2026");
    expect(formatDay("2026-10-05T20:00:00.000Z", "Asia/Jakarta")).toBe("6 Oct 2026");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-07T03:04:00.000Z");

  it("says how long ago, in the largest unit that fits", () => {
    expect(formatRelative(iso, now)).toBe("2 days ago");
    expect(formatRelative("2026-10-07T02:04:00.000Z", now)).toBe("1 hour ago");
    expect(formatRelative("2026-10-07T03:03:30.000Z", now)).toBe("now");
    expect(formatRelative("2025-09-01T00:00:00.000Z", now)).toBe("last year");
  });
});
