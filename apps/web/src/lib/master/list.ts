import type { z } from "zod";

/** The list pages that page through a filtered query. */
export type MasterListPathname = "/master/divisions" | "/master/roles" | "/master/users";

/**
 * A list page's query parameters, coerced and defaulted by the shared schema.
 * A malformed query falls back to the schema's own defaults rather than
 * failing the page — a hand-typed URL should not be a 500.
 */
export function parseListQuery<T extends z.ZodType>(schema: T, url: URL): z.infer<T> {
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  return (parsed.success ? parsed.data : schema.parse({})) as z.infer<T>;
}

/**
 * The same query, on another page, with empty values dropped. The caller
 * passes the result through `resolve()` — the type says it is a pathname this
 * app has, because the base is one of the list routes.
 */
export function pageHref(
  base: MasterListPathname,
  query: Record<string, unknown>,
  page: number
): `${MasterListPathname}?${string}` {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  params.set("page", String(page));
  return `${base}?${params.toString()}`;
}
