import { z } from "zod";
import { checkboxSchema, optionalText } from "./inputs.js";
import { PageSchema, PerPageSchema, SearchSchema, listResponse } from "./list.js";

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
  iconName: z
    .string()
    .trim()
    .min(1, "Icon is required.")
    .max(255)
    .default("heroicon-o-rocket-launch"),
  isActive: checkboxSchema
});

export type RoleInput = z.infer<typeof RoleInputSchema>;

export const RoleSortSchema = z.enum(["name", "updatedAt"]).default("name");

export const RoleListQuerySchema = z.object({
  search: SearchSchema,
  active: z.enum(["all", "active", "inactive"]).default("all"),
  sort: RoleSortSchema,
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: PageSchema,
  perPage: PerPageSchema
});

export type RoleListQuery = z.infer<typeof RoleListQuerySchema>;

export const RoleListResponseSchema = listResponse(RoleSchema);

export type RoleListResponse = z.infer<typeof RoleListResponseSchema>;
