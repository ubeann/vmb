import { z } from "zod";

/** The page sizes the legacy tables offered; the UI only ever offers these. */
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/** One default for every list, so the API and the list kit's footer agree (#301). */
export const DEFAULT_PER_PAGE = 25;

export const PerPageSchema = z.coerce
  .number()
  .int()
  .refine((value) => (PER_PAGE_OPTIONS as readonly number[]).includes(value), {
    message: `perPage must be one of ${PER_PAGE_OPTIONS.join(", ")}.`
  })
  .default(DEFAULT_PER_PAGE);

export const PageSchema = z.coerce.number().int().min(1).default(1);

/** An empty `?search=` is no search, not a search for the empty string. */
export const SearchSchema = z
  .string()
  .trim()
  .max(255)
  .transform((value) => (value ? value : undefined))
  .optional();

/**
 * `exclude` hides soft-deleted rows (the default), `only` is the legacy
 * "trashed" filter, and `include` backs no view yet but keeps the query honest
 * about what it can express.
 */
export const TrashedSchema = z.enum(["exclude", "include", "only"]).default("exclude");

export const SortDirectionSchema = z.enum(["asc", "desc"]).default("asc");

/** How many rows a list holds; a count is never negative. */
const CountSchema = z.number().int().min(0);

/** Wrap an entity in the envelope every list endpoint answers with. */
export function listResponse<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: CountSchema,
    page: z.number().int().min(1),
    perPage: z.number().int().positive()
  });
}

/**
 * How many rows each view (the All and Trash tabs) would show, with the search
 * and filters kept, so a tab reads what a click on it would list (ADR-0051
 * rule 2).
 */
export const ViewCountsSchema = z.object({ all: CountSchema, trash: CountSchema });

/** For each option of a value filter, how many rows choosing it would give (ADR-0051 rule 4). */
export function optionCounts<const T extends readonly [string, ...string[]]>(values: T) {
  return z.object(
    Object.fromEntries(values.map((value) => [value, CountSchema])) as Record<
      T[number],
      typeof CountSchema
    >
  );
}

/**
 * A value filter's parameter split into its values: none means any, several
 * are one comma-separated parameter (`status=active,inactive`, ADR-0051 rule
 * 4). `all` was the single-value lists' "any" and still means it, so an old
 * URL keeps working.
 */
export function splitListParam(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "" && value !== "all");
}

/**
 * A value filter: the values chosen, in the order the list offers them, each
 * once. An unknown value fails at its own index, so `parseListQuery` can drop
 * that value and keep the others.
 */
export function valueFilter<const T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform(splitListParam)
    .pipe(z.array(z.enum(values)))
    .transform((picked): T[number][] => values.filter((value) => picked.includes(value)))
    .default([]);
}

/** Two calendar days, both included, `from` never after `to`. */
export type DateRange = { from: string; to: string };

/** `day` moved by a number of calendar days. */
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The date filters' presets, Today, Last 7 days and This month (ADR-0051 rule
 * 4), each as the days it covers counted from today.
 */
const PRESET_RANGES = {
  today: (today: string) => ({ from: today, to: today }),
  week: (today: string) => ({ from: addDays(today, -6), to: today }),
  month: (today: string) => ({ from: `${today.slice(0, 8)}01`, to: today })
} satisfies Record<string, (today: string) => DateRange>;

export type DatePreset = keyof typeof PRESET_RANGES;

export const DATE_PRESETS = Object.keys(PRESET_RANGES) as DatePreset[];

function isDatePreset(value: string): value is DatePreset {
  return Object.hasOwn(PRESET_RANGES, value);
}

const RANGE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

function isCalendarDay(value: string): boolean {
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/** A custom range, `YYYY-MM-DD..YYYY-MM-DD`; null for anything else, such as 31 February. */
export function parseDateRange(value: string): DateRange | null {
  const match = RANGE_PATTERN.exec(value);
  if (!match) return null;
  const [, from = "", to = ""] = match;
  if (!isCalendarDay(from) || !isCalendarDay(to) || from > to) return null;
  return { from, to };
}

/**
 * A date filter: a preset, which keeps a link relative to the day it is
 * opened, or a custom range. An empty value is no filter.
 */
export const DateFilterSchema = z
  .string()
  .trim()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || isDatePreset(value) || parseDateRange(value), {
    message: "Use today, week, month or a YYYY-MM-DD..YYYY-MM-DD range."
  })
  .optional();

/** Today's date in `timeZone`, as `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const part = (type: string) => parts.find((each) => each.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The days a date filter covers, counted from `today`; null when it is no filter or invalid. */
export function dateFilterRange(value: string | undefined, today: string): DateRange | null {
  if (!value) return null;
  return isDatePreset(value) ? PRESET_RANGES[value](today) : parseDateRange(value);
}

/**
 * A date filter as the API takes it: the preset turned into its days, so the
 * reader's today decides what "Today" means rather than the server's.
 */
export function resolveDateFilter(value: string | undefined, today: string): string | undefined {
  const range = dateFilterRange(value, today);
  return range ? `${range.from}..${range.to}` : undefined;
}

/** The value to keep in the URL for a range: its preset when it equals one, so the link stays relative. */
export function dateFilterValue(range: DateRange, today: string): string {
  const preset = DATE_PRESETS.find((each) => {
    const days = PRESET_RANGES[each](today);
    return days.from === range.from && days.to === range.to;
  });
  return preset ?? `${range.from}..${range.to}`;
}

/**
 * The zone everyone reads in until each user has their own (#115). The
 * company works on WIB.
 */
export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

/**
 * An IANA zone such as `Asia/Jakarta`, which turns a calendar day into the
 * instants it spans. Offsets such as `+07:00` are refused: Postgres reads a
 * bare offset with the sign flipped.
 */
export const TimeZoneSchema = z
  .string()
  .refine(
    (value) => {
      if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(value)) return false;
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Use an IANA time zone such as Asia/Jakarta." }
  )
  .default(DEFAULT_TIME_ZONE);

/** Most records one bulk action takes: a page at its largest (#305). */
export const BULK_MAX = 100;

/**
 * A bulk action on a list's records: delete or restore the `ids`, all or none
 * (#305). The ids come from one page of a list, so a request may repeat an
 * id and never names more than a page holds.
 */
export const BulkRequestSchema = z.object({
  action: z.enum(["delete", "restore"]),
  ids: z.array(z.uuid()).min(1, "Choose at least one record.").max(BULK_MAX)
});

export type BulkRequest = z.infer<typeof BulkRequestSchema>;

/**
 * A Division's bulk action: delete or restore as above, or switch every one on
 * or off, as an explicit target state so a selection never ends half-flipped
 * (#467).
 */
export const DivisionBulkRequestSchema = BulkRequestSchema.extend({
  action: z.enum(["delete", "restore", "activate", "deactivate"])
});

export type DivisionBulkRequest = z.infer<typeof DivisionBulkRequestSchema>;

/** The records a bulk action changed, once each, for the Undo that follows it. */
export const BulkResponseSchema = z.object({ ids: z.array(z.uuid()) });

export type BulkResponse = z.infer<typeof BulkResponseSchema>;
