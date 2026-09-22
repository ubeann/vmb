import { z } from "zod";

/** The page sizes the legacy tables offered; the UI only ever offers these. */
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export const PerPageSchema = z.coerce
  .number()
  .int()
  .refine((value) => (PER_PAGE_OPTIONS as readonly number[]).includes(value), {
    message: `perPage must be one of ${PER_PAGE_OPTIONS.join(", ")}.`
  })
  .default(10);

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

/** Wrap an entity in the envelope every list endpoint answers with. */
export function listResponse<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    perPage: z.number().int().positive()
  });
}

/** One validation failure, flattened for a form or an API error body. */
export const ValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string()
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  issues: z.array(ValidationIssueSchema).optional()
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
