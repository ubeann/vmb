import { describe, expect, it } from "vitest";
import {
  describeDateFilter,
  formatApplyRange,
  formatRange,
  formatShortRange,
  isCustomRange,
  PRESETS
} from "./dates.js";

const TODAY = "2026-01-08";
const range = (from: string, to: string) => ({ from, to });

describe("formatShortRange", () => {
  it("drops the years of a recent range", () => {
    expect(formatShortRange(range("2026-01-02", "2026-01-05"), TODAY)).toBe("2 – 5 Jan");
    expect(formatShortRange(range("2026-01-05", "2026-01-05"), TODAY)).toBe("5 Jan");
    expect(formatShortRange(range("2025-12-29", "2026-01-04"), TODAY)).toBe("29 Dec – 4 Jan");
  });

  it("keeps the years once the range ends in an earlier year", () => {
    expect(formatShortRange(range("2025-11-01", "2025-12-31"), TODAY)).toBe("1 Nov – 31 Dec 2025");
  });

  it("keeps the years of a range a year long or more, which would read as one day twice", () => {
    expect(formatShortRange(range("2025-01-07", "2026-01-08"), TODAY)).toBe(
      "7 Jan 2025 – 8 Jan 2026"
    );
    expect(formatShortRange(range("2025-01-08", "2026-01-08"), TODAY)).toBe(
      "8 Jan 2025 – 8 Jan 2026"
    );
    expect(formatShortRange(range("2025-01-09", "2026-01-08"), TODAY)).toBe("9 Jan – 8 Jan");
  });
});

describe("formatRange", () => {
  it("writes one year when both ends share it", () => {
    expect(formatRange(range("2025-11-01", "2025-12-31"))).toBe("1 Nov – 31 Dec 2025");
    expect(formatRange(range("2026-01-02", "2026-01-05"))).toBe("2 – 5 Jan 2026");
  });

  it("writes both years across New Year", () => {
    expect(formatRange(range("2025-11-01", "2026-01-08"))).toBe("1 Nov 2025 – 8 Jan 2026");
  });

  it("writes a single day with its year", () => {
    expect(formatRange(range("2026-01-08", "2026-01-08"))).toBe("8 Jan 2026");
  });
});

describe("formatApplyRange", () => {
  it("is short for a recent range in one year", () => {
    expect(formatApplyRange(range("2026-01-02", "2026-01-05"), TODAY)).toBe("2 – 5 Jan");
  });

  it("keeps the years across New Year, even when recent", () => {
    expect(formatApplyRange(range("2025-12-29", "2026-01-04"), TODAY)).toBe(
      "29 Dec 2025 – 4 Jan 2026"
    );
    expect(formatApplyRange(range("2025-11-01", "2026-01-08"), TODAY)).toBe(
      "1 Nov 2025 – 8 Jan 2026"
    );
  });

  it("keeps the year of an older range, shared once", () => {
    expect(formatApplyRange(range("2025-11-01", "2025-12-31"), TODAY)).toBe("1 Nov – 31 Dec 2025");
  });
});

describe("describeDateFilter", () => {
  it("names a preset and words a custom range", () => {
    expect(describeDateFilter("week", TODAY)).toBe("Last 7 days");
    expect(describeDateFilter("2026-01-02..2026-01-05", TODAY)).toBe("2 – 5 Jan");
  });

  it("is null for no filter or one the API would refuse", () => {
    expect(describeDateFilter(null, TODAY)).toBeNull();
    expect(describeDateFilter("", TODAY)).toBeNull();
    expect(describeDateFilter("yesterday", TODAY)).toBeNull();
    expect(describeDateFilter("2026-02-31..2026-03-02", TODAY)).toBeNull();
  });
});

describe("isCustomRange", () => {
  it("separates a range from a preset", () => {
    expect(isCustomRange("2026-01-02..2026-01-05", TODAY)).toBe(true);
    expect(isCustomRange("week", TODAY)).toBe(false);
    expect(isCustomRange(null, TODAY)).toBe(false);
    expect(isCustomRange("garbage", TODAY)).toBe(false);
  });
});

describe("PRESETS", () => {
  it("lists Today, Last 7 days and This month", () => {
    expect(PRESETS.map(({ label }) => label)).toEqual(["Today", "Last 7 days", "This month"]);
  });
});
