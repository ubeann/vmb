import { z } from "zod";
import { checkboxSchema, optionalText } from "./inputs.js";
import {
  PageSchema,
  PerPageSchema,
  SearchSchema,
  SortDirectionSchema,
  TrashedSchema,
  listResponse
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
    .min(3, "Code must be at least 3 characters.")
    .max(5, "Code must be at most 5 characters."),
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

export const DivisionSortSchema = z
  .enum(["name", "code", "createdAt", "updatedAt"])
  .default("name");

export const DivisionListQuerySchema = z.object({
  search: SearchSchema,
  status: z.enum(["all", "active", "inactive"]).default("all"),
  trashed: TrashedSchema,
  sort: DivisionSortSchema,
  dir: SortDirectionSchema,
  page: PageSchema,
  perPage: PerPageSchema
});

export type DivisionListQuery = z.infer<typeof DivisionListQuerySchema>;

export const DivisionListResponseSchema = listResponse(DivisionSchema);

export type DivisionListResponse = z.infer<typeof DivisionListResponseSchema>;
