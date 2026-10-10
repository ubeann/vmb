// PROTOTYPE (prototype/list-kit): the date filters' presets and ranges, measured from the
// fixtures' "today" so the prototype reads the same whatever day it is opened.

export const TODAY = "2026-01-08";

export const PRESET_RANGE: Record<string, [string, string]> = {
  today: [TODAY, TODAY],
  week: ["2026-01-02", TODAY],
  month: ["2026-01-01", TODAY]
};

/** A date filter's value is a preset key or a custom `YYYY-MM-DD..YYYY-MM-DD` range. */
export function dateRange(value: string | null): [string, string] | null {
  if (!value) return null;
  const preset = PRESET_RANGE[value];
  if (preset) return preset;
  const match = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(value);
  return match ? [match[1]!, match[2]!] : null;
}

export function within(iso: string | null, value: string | null): boolean {
  const range = dateRange(value);
  if (!range) return true;
  const day = (iso ?? "").slice(0, 10);
  return day >= range[0] && day <= range[1];
}

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "8 Jan 2026", "2 – 8 Jan 2026", "28 Dec 2025 – 8 Jan 2026" */
export function formatRange([start, end]: [string, string]): string {
  if (start === end) return DAY.format(date(start));
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${Number(start.slice(8))} – ${DAY.format(date(end))}`;
  return `${DAY.format(date(start))} – ${DAY.format(date(end))}`;
}
