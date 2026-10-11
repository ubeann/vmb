import { splitListParam } from "@vmb/types";
import type { z } from "zod";

/** The list pages that page through a filtered query. */
export type MasterListPathname = "/master/divisions" | "/master/roles" | "/master/users";

/**
 * A list page's query parameters, coerced and defaulted by the shared schema.
 * A parameter the schema refuses falls back to its default and the rest still
 * apply, rather than failing the page — a hand-typed URL should not be a 500.
 * In a value filter (`status=active,archived`) only the refused value goes.
 * A repeated parameter takes its last value.
 */
export function parseListQuery<T extends z.ZodType>(schema: T, url: URL): z.infer<T> {
  const raw: Record<string, string> = Object.fromEntries(url.searchParams);
  let parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // a value filter's issue names the value's index after `splitListParam`
    const refused = new Map<string, Set<number> | "all">();
    for (const [key, index] of parsed.error.issues.map((issue) => issue.path)) {
      const name = String(key);
      const known = refused.get(name);
      if (typeof index !== "number") refused.set(name, "all");
      else if (known !== "all") refused.set(name, (known ?? new Set()).add(index));
    }
    for (const [key, indexes] of refused) {
      if (indexes === "all") delete raw[key];
      else
        raw[key] = splitListParam(raw[key] ?? "")
          .filter((_, index) => !indexes.has(index))
          .join(",");
    }
    parsed = schema.safeParse(raw);
  }
  return (parsed.success ? parsed.data : schema.parse({})) as z.infer<T>;
}

/**
 * A query string with the commas of a value filter left as they are
 * (`status=active,inactive`), which a URL allows and a reader can read.
 */
function queryString(params: URLSearchParams): string {
  return params.toString().replaceAll("%2C", ",");
}

/**
 * The query string a list URL should have once parsed: each parameter the
 * schema took, once, in its parsed form, with defaults left implicit. A list
 * redirects to it when the URL differs (#301), because the controls build
 * their links from the URL and would otherwise carry values the server
 * ignored, such as an invalid `perPage` or the losing copy of a repeated one.
 */
export function canonicalListSearch<T extends z.ZodType>(
  schema: T,
  url: URL,
  query: z.infer<T>
): string {
  const defaults = schema.parse({}) as Record<string, unknown>;
  const values = query as Record<string, unknown>;
  const params = new URLSearchParams();
  for (const key of new Set(url.searchParams.keys())) {
    const value = values[key];
    if (value === undefined || value === null || value === "") continue;
    // a value filter's array joins with commas, and an empty one matches its default
    if (String(value) === String(defaults[key])) continue;
    params.set(key, String(value));
  }
  const search = queryString(params);
  return search ? `?${search}` : "";
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
  return `${base}?${queryString(params)}`;
}

/** A list URL: one of the list routes, with or without a query. */
export type MasterListHref = MasterListPathname | `${MasterListPathname}?${string}`;

/**
 * A value filter's parameter with one value switched on or off, in the order
 * the list offers its values (the order the URL is canonical in). `null` once
 * no value is left, which `listHref` takes as dropping the parameter.
 */
export function toggleListValue(
  current: string | null,
  value: string,
  order: readonly string[]
): string | null {
  const picked = new Set(splitListParam(current ?? ""));
  if (!picked.delete(value)) picked.add(value);
  const next = order.filter((candidate) => picked.has(candidate));
  return next.length > 0 ? next.join(",") : null;
}

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

  const query = queryString(next);
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

/**
 * The footer's count line (ADR-0051 rule 5). `outOf` is how many rows the view
 * holds before the search and filters, or null when none is set: a narrowed
 * list that fits one page reads "3 of 12 divisions", and one that pages keeps
 * its range and says what it was cut from.
 */
export function countSummary(
  list: { page: number; perPage: number; total: number },
  noun: string,
  outOf: number | null
): string {
  const range = showingRange(list);
  if (list.total === 0) return outOf === null ? `No ${noun}` : `0 of ${outOf} ${noun}`;
  if (range.from === 0) return `${list.total} ${noun} in all, none on this page`;
  if (outOf !== null && range.from === 1 && range.to === list.total)
    return `${list.total} of ${outOf} ${noun}`;
  const showing = `Showing ${range.from}–${range.to} of ${list.total}`;
  return outOf === null ? showing : `${showing} · ${outOf} ${noun} in all`;
}
