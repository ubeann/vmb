/**
 * Record timestamps as the lists show them (#301): the absolute date and time
 * in the reader's timezone, with the relative time beside it in a tooltip.
 * The copy is English (en-GB order: day, month, year) until the Bahasa
 * Indonesia translation lands.
 */

/** "5 Oct 2026, 10:04" in `timeZone`; the browser's own zone when it is omitted. */
export function formatAbsolute(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone
  }).format(new Date(iso));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60]
];

/** "2 days ago": the largest unit that fits at least once; under a minute is "now". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = (new Date(iso).getTime() - now.getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, "second");
}
