import { z } from "zod";
import { checkboxSchema, optionalText, updatedAtSchema } from "./inputs.js";
import {
  DateFilterSchema,
  PageSchema,
  PerPageSchema,
  SearchSchema,
  SortDirectionSchema,
  TimeZoneSchema,
  TrashedSchema,
  ViewCountsSchema,
  listResponse,
  optionCounts,
  valueFilter
} from "./list.js";

export const DivisionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  colorHex: z.string(),
  iconName: z.string(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable()
});

export type Division = z.infer<typeof DivisionSchema>;

/**
 * One division's detail: the record plus how many Users are in it, so a
 * delete can say what it would affect (#446). A User is in a division when
 * they hold a role scoped to it; Trashed Users are not counted.
 */
export const DivisionDetailSchema = DivisionSchema.extend({
  userCount: z.number().int().min(0)
});

export type DivisionDetail = z.infer<typeof DivisionDetailSchema>;

/** The 3–5 character business key the legacy form enforced (`DivisionResource.php:97-104`). */
export const DivisionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(255, "Name must be 255 characters or fewer."),
  code: z
    .string()
    .trim()
    // an empty code says only that it is required, not also that it is short
    .min(1, { error: "Code is required.", abort: true })
    .min(3, "Code must be 3 to 5 characters.")
    .max(5, "Code must be 3 to 5 characters."),
  description: optionalText(1000),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value such as #2563EB.")
    .default("#000000"),
  iconName: z
    .string()
    .trim()
    .min(1, "Icon is required.")
    .max(255)
    .default("heroicon-o-rocket-launch"),
  isActive: checkboxSchema
});

export type DivisionInput = z.infer<typeof DivisionInputSchema>;

/** An edit: the fields of a new division plus the `updatedAt` the editor loaded. */
export const DivisionUpdateInputSchema = DivisionInputSchema.extend({
  updatedAt: updatedAtSchema
});

export type DivisionUpdateInput = z.infer<typeof DivisionUpdateInputSchema>;

export const DivisionSortSchema = z
  .enum(["name", "code", "createdAt", "updatedAt"])
  .default("name");

/** The Status filter's options, in the order the Filter panel lists them. */
export const DIVISION_STATUSES = ["active", "inactive"] as const;

/**
 * The Divisions list's state, as its URL carries it (#301, ADR-0051 rule 4):
 * `status` takes several values (`active,inactive`), and `updated` and
 * `created` a preset (`today`, `week`, `month`) or an inclusive
 * `YYYY-MM-DD..YYYY-MM-DD` range.
 */
export const DivisionListQuerySchema = z.object({
  search: SearchSchema,
  status: valueFilter(DIVISION_STATUSES),
  updated: DateFilterSchema,
  created: DateFilterSchema,
  trashed: TrashedSchema,
  sort: DivisionSortSchema,
  dir: SortDirectionSchema,
  page: PageSchema,
  perPage: PerPageSchema
});

export type DivisionListQuery = z.infer<typeof DivisionListQuerySchema>;

/**
 * What `GET /api/master/divisions` takes: the list's state plus the reader's
 * time zone, which decides where each day of a date filter starts and ends. A
 * preset is read as of today in that zone; the web resolves presets to ranges
 * itself before calling, so the URL can keep the preset.
 */
export const DivisionListRequestSchema = DivisionListQuerySchema.extend({ tz: TimeZoneSchema });

export type DivisionListRequest = z.infer<typeof DivisionListRequestSchema>;

/**
 * A page of divisions, with the counts the list kit shows beside its
 * controls: each view's rows (the All and Trash tabs), and each Status
 * option's rows in the current view. Every count keeps the search and the
 * other filters.
 */
export const DivisionListResponseSchema = listResponse(DivisionSchema).extend({
  views: ViewCountsSchema,
  facets: z.object({ status: optionCounts(DIVISION_STATUSES) })
});

export type DivisionListResponse = z.infer<typeof DivisionListResponseSchema>;
