// How the list kit words a date filter (ADR-0051 rule 4): the presets' names,
// and a range as the panel, the chips and the Apply button write it.

import {
  DATE_PRESETS,
  DEFAULT_TIME_ZONE,
  dateFilterRange,
  todayIn,
  type DatePreset,
  type DateRange
} from "@vmb/types";

/** The presets in the order the panel lists them, with the names it gives them. */
export const PRESETS: readonly { value: DatePreset; label: string }[] = DATE_PRESETS.map(
  (value) => ({
    value,
    label: { today: "Today", week: "Last 7 days", month: "This month" }[value]
  })
);

/**
 * Today, in the zone the list's date filters read their days in. The server
 * resolves a preset against the same zone (`todayIn(DEFAULT_TIME_ZONE)` in the
 * page's load), so a chip and the rows it filters agree on what "Today" is.
 */
export const readerToday = () => todayIn(DEFAULT_TIME_ZONE);

const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const WITH_YEAR = format({ day: "numeric", month: "short", year: "numeric" });
const WITHOUT_YEAR = format({ day: "numeric", month: "short" });

const date = (day: string) => new Date(`${day}T00:00:00Z`);
const year = (day: string) => day.slice(0, 4);
const month = (day: string) => day.slice(0, 7);

/**
 * A range in full, the years kept: "8 Jan 2026", "2 – 8 Jan 2026", "1 Nov – 31
 * Dec 2025" (one year when both ends share it), "1 Nov 2025 – 8 Jan 2026".
 */
export function formatRange({ from, to }: DateRange): string {
  if (from === to) return WITH_YEAR.format(date(to));
  if (month(from) === month(to)) return `${Number(from.slice(8))} – ${WITH_YEAR.format(date(to))}`;
  if (year(from) === year(to))
    return `${WITHOUT_YEAR.format(date(from))} – ${WITH_YEAR.format(date(to))}`;
  return `${WITH_YEAR.format(date(from))} – ${WITH_YEAR.format(date(to))}`;
}

/**
 * A range as a row or a chip wants it: a recent one, ending this year and
 * starting less than a year before its end, drops the years ("2 – 5 Jan", "29
 * Dec – 4 Jan"); an older one keeps them, as `formatRange` writes them.
 */
export function formatShortRange(range: DateRange, today: string): string {
  const { from, to } = range;
  const yearBefore = `${Number(year(to)) - 1}${to.slice(4)}`;
  if (year(to) !== year(today) || from <= yearBefore) return formatRange(range);
  if (from === to) return WITHOUT_YEAR.format(date(to));
  if (month(from) === month(to))
    return `${Number(from.slice(8))} – ${WITHOUT_YEAR.format(date(to))}`;
  return `${WITHOUT_YEAR.format(date(from))} – ${WITHOUT_YEAR.format(date(to))}`;
}

/** The days in "Apply 2 – 5 Jan": short when recent, with the years once the range crosses New Year. */
export function formatApplyRange(range: DateRange, today: string): string {
  return year(range.from) === year(range.to) ? formatShortRange(range, today) : formatRange(range);
}

/**
 * What a date filter's value reads as: a preset's name, a range's days, or
 * null for no filter (or one the API would refuse).
 */
export function describeDateFilter(value: string | null | undefined, today: string): string | null {
  if (!value) return null;
  const preset = PRESETS.find((each) => each.value === value);
  if (preset) return preset.label;
  const range = dateFilterRange(value, today);
  return range ? formatShortRange(range, today) : null;
}

/** Whether a date filter's value is a custom range, not one of the presets. */
export const isCustomRange = (value: string | null | undefined, today: string) =>
  Boolean(value) &&
  !PRESETS.some((each) => each.value === value) &&
  dateFilterRange(value ?? "", today) !== null;
