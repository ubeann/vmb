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

/** A list URL: one of the list routes, with or without a query. */
export type MasterListHref = MasterListPathname | `${MasterListPathname}?${string}`;

/**
 * The list kit keeps its whole state in the URL (#301), so every control is a
 * link to the same list with one or more parameters changed. `null` or an
 * empty string removes a parameter. Any change other than the page goes back to
 * page 1, because the rows the old page number counted have changed; page 1
 * itself is left implicit.
 */
export function listHref(
  base: MasterListPathname,
  params: URLSearchParams,
  changes: Record<string, string | number | null>
): MasterListHref {
  const next = new URLSearchParams(params);
  if (!("page" in changes)) next.delete("page");

  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "" || (key === "page" && value === 1)) next.delete(key);
    else next.set(key, String(value));
  }

  const query = next.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * A sortable column header's state: what it tells a screen reader, and where
 * a click takes the list. The sorted column flips its direction; any other
 * column starts ascending.
 */
export function sortState(
  base: MasterListPathname,
  params: URLSearchParams,
  current: { sort: string; dir: "asc" | "desc" },
  column: string
): { ariaSort: "ascending" | "descending" | "none"; href: MasterListHref } {
  const sorted = current.sort === column;
  const dir = sorted && current.dir === "asc" ? "desc" : "asc";
  return {
    ariaSort: sorted ? (current.dir === "asc" ? "ascending" : "descending") : "none",
    href: listHref(base, params, { sort: column, dir })
  };
}

/**
 * The numbered pages a footer shows: all of them when there are seven or
 * fewer, otherwise always seven slots (the first and last page, the current
 * page and its neighbours, and gaps), so the footer doesn't change width as
 * you page through.
 */
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);

  if (totalPages <= 7) return range(1, totalPages);
  if (page <= 4) return [...range(1, 5), "gap", totalPages];
  if (page >= totalPages - 3) return [1, "gap", ...range(totalPages - 4, totalPages)];
  return [1, "gap", page - 1, page, page + 1, "gap", totalPages];
}

/**
 * The rows a page shows, for "Showing x–y of n"; `0–0` when there are none,
 * including a page past the end (a hand-typed URL, or the last rows deleted).
 */
export function showingRange(list: { page: number; perPage: number; total: number }): {
  from: number;
  to: number;
} {
  if (list.total === 0) return { from: 0, to: 0 };
  const from = (list.page - 1) * list.perPage + 1;
  if (from > list.total) return { from: 0, to: 0 };
  return { from, to: Math.min(list.total, from + list.perPage - 1) };
}
