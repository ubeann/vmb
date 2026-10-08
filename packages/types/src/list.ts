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

/** Wrap an entity in the envelope every list endpoint answers with. */
export function listResponse<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    perPage: z.number().int().positive()
  });
}
