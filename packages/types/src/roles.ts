import { z } from "zod";
import { IconNameSchema } from "./icons.js";
import { checkboxSchema, optionalText, updatedAtSchema } from "./inputs.js";
import {
  DateFilterSchema,
  PageSchema,
  PerPageSchema,
  SearchSchema,
  SortDirectionSchema,
  TimeZoneSchema,
  listResponse,
  optionCounts,
  valueFilter
} from "./list.js";

export const RoleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isActive: z.boolean(),
  isSystem: z.boolean(),
  colorHex: z.string(),
  iconName: z.string(),
  description: z.string().nullable(),
  divisionId: z.uuid().nullable(),
  createdAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime().nullable()
});

export type Role = z.infer<typeof RoleSchema>;

/**
 * `is_system` is not settable: system roles are seeded, and the legacy policy
 * refused to view, edit or delete them. `divisionId` is not settable here yet;
 * the Roles form gains it with role assignment (#8).
 */
export const RoleInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(255, "Name must be 255 characters or fewer."),
  description: optionalText(255),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value such as #3182CE.")
    .default("#000000"),
  iconName: IconNameSchema.default("rocket"),
  isActive: checkboxSchema
});

export type RoleInput = z.infer<typeof RoleInputSchema>;

/** An edit: the fields of a new role plus the `updatedAt` the editor loaded. */
export const RoleUpdateInputSchema = RoleInputSchema.extend({ updatedAt: updatedAtSchema });

export type RoleUpdateInput = z.infer<typeof RoleUpdateInputSchema>;

/**
 * One role's detail: the record plus the name of its Division, so the view can
 * say where it applies. A role with no Division applies in every Division.
 */
export const RoleDetailSchema = RoleSchema.extend({ divisionName: z.string().nullable() });

export type RoleDetail = z.infer<typeof RoleDetailSchema>;

export const RoleSortSchema = z.enum(["name", "createdAt", "updatedAt"]).default("name");

/** The Status filter's options, in the order the Filter panel lists them. */
export const ROLE_STATUSES = ["active", "inactive"] as const;

/**
 * The Roles list's state, as its URL carries it (#303, ADR-0051 rule 4):
 * `status` takes several values (`active,inactive`), and `updated` and
 * `created` a preset (`today`, `week`, `month`) or an inclusive
 * `YYYY-MM-DD..YYYY-MM-DD` range. Roles have no Trash, so there is no view.
 */
export const RoleListQuerySchema = z.object({
  search: SearchSchema,
  status: valueFilter(ROLE_STATUSES),
  updated: DateFilterSchema,
  created: DateFilterSchema,
  sort: RoleSortSchema,
  dir: SortDirectionSchema,
  page: PageSchema,
  perPage: PerPageSchema
});

export type RoleListQuery = z.infer<typeof RoleListQuerySchema>;

/**
 * What `GET /api/master/roles` takes: the list's state plus the reader's time
 * zone, which decides where each day of a date filter starts and ends (as for
 * Divisions).
 */
export const RoleListRequestSchema = RoleListQuerySchema.extend({ tz: TimeZoneSchema });

export type RoleListRequest = z.infer<typeof RoleListRequestSchema>;

/**
 * A page of roles, with how many rows each Status option would give under the
 * search and the other filters (ADR-0051 rule 4).
 */
export const RoleListResponseSchema = listResponse(RoleSchema).extend({
  facets: z.object({ status: optionCounts(ROLE_STATUSES) })
});

export type RoleListResponse = z.infer<typeof RoleListResponseSchema>;
