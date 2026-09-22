import { z } from "zod";
import { checkboxSchema, optionalText } from "./inputs.js";
import { PageSchema, PerPageSchema, SearchSchema, listResponse } from "./list.js";

/**
 * The legacy `RoleAccessLevel` integer enum. Levels are ordered; higher levels
 * inherit from lower ones in the legacy authorization layer.
 */
export const ROLE_ACCESS_LEVELS = [
  { value: 0, label: "Basic Access" },
  { value: 1, label: "Supervisor Access" },
  { value: 2, label: "Manager Access" },
  { value: 3, label: "Administrator Access" }
] as const;

export const RoleAccessLevelSchema = z.coerce
  .number()
  .default(0)
  .pipe(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]));

export type RoleAccessLevel = z.infer<typeof RoleAccessLevelSchema>;

export const RoleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  guardName: z.string(),
  level: z.number().int(),
  isActive: z.boolean(),
  isSystem: z.boolean(),
  colorHex: z.string(),
  iconName: z.string(),
  description: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime().nullable()
});

export type Role = z.infer<typeof RoleSchema>;

/**
 * `guard_name` is not a field: the legacy form shows it disabled and pinned to
 * the panel guard, so every role this module creates carries `web`.
 * `is_system` is not settable either — system roles are seeded, and the legacy
 * policy refused to view, edit or delete them.
 */
export const RoleInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(255, "Name must be 255 characters or fewer."),
  level: RoleAccessLevelSchema,
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

export const RoleSortSchema = z.enum(["name", "level", "updatedAt"]).default("level");

export const RoleListQuerySchema = z.object({
  search: SearchSchema,
  level: z
    .union([z.literal("all"), z.literal("0"), z.literal("1"), z.literal("2"), z.literal("3")])
    .default("all"),
  active: z.enum(["all", "active", "inactive"]).default("all"),
  sort: RoleSortSchema,
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: PageSchema,
  perPage: PerPageSchema
});

export type RoleListQuery = z.infer<typeof RoleListQuerySchema>;

export const RoleListResponseSchema = listResponse(RoleSchema);

export type RoleListResponse = z.infer<typeof RoleListResponseSchema>;

/** The guard every role this admin creates belongs to; Spatie's panel guard. */
export const DEFAULT_ROLE_GUARD = "web";
