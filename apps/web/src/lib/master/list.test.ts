import {
  DivisionListQuerySchema,
  dateFilterRange,
  dateFilterValue,
  resolveDateFilter,
  todayIn
} from "@vmb/types";
import { describe, expect, it } from "vitest";
import {
  canonicalListSearch,
  countSummary,
  isCanonicalListSearch,
  listHref,
  pageWindow,
  parseListQuery,
  showingRange,
  sortState,
  toggleListValue
} from "./list.js";

const parse = (search: string) => {
  const url = new URL(`https://vmb.test/master/divisions${search}`);
  const query = parseListQuery(DivisionListQuerySchema, url);
  return { query, canonical: canonicalListSearch(DivisionListQuerySchema, url, query) };
};

describe("isCanonicalListSearch", () => {
  const at = (search: string) => {
    const { canonical } = parse(search);
    return isCanonicalListSearch(new URL(`https://vmb.test/master/divisions${search}`), canonical);
  };

  it("holds for a query that is already canonical, a comma or its encoding alike", () => {
    expect(at("")).toBe(true);
    expect(at("?status=active,inactive")).toBe(true);
    // a client-side navigation re-encodes the comma before the load sees it
    expect(at("?status=active%2Cinactive&updated=week")).toBe(true);
  });

  it("fails for a query the canonical form would change", () => {
    expect(at("?perPage=7&status=inactive")).toBe(false);
    expect(at("?status=inactive,active")).toBe(false);
    expect(at("?page=1")).toBe(false);
  });
});

describe("parseListQuery and canonicalListSearch", () => {
  it("leave a well-formed query as it is", () => {
    expect(parse("?search=ops&sort=code&page=2")).toMatchObject({
      query: { search: "ops", sort: "code", page: 2, perPage: 25 },
      canonical: "?search=ops&sort=code&page=2"
    });
  });

  it("drop only the parameter the schema refuses", () => {
    expect(parse("?perPage=7&status=inactive")).toMatchObject({
      query: { perPage: 25, status: ["inactive"] },
      canonical: "?status=inactive"
    });
  });

  it("take the last copy of a repeated parameter, once", () => {
    expect(parse("?status=active&status=inactive").canonical).toBe("?status=inactive");
  });

  it("leave defaults and empty values implicit, and normalise the rest", () => {
    expect(parse("?page=1&perPage=25&search=&sort=name&dir=asc").canonical).toBe("");
    expect(parse("?page=02&search=%20ops%20").canonical).toBe("?page=2&search=ops");
  });

  it("take several statuses as one comma-separated parameter, in the list's order", () => {
    expect(parse("?status=inactive,active")).toMatchObject({
      query: { status: ["active", "inactive"] },
      canonical: "?status=active,inactive"
    });
    expect(parse("?status=active%2Cinactive").canonical).toBe("?status=active,inactive");
  });

  it("read the old status=all, or no status, as any status", () => {
    expect(parse("?status=all")).toMatchObject({ query: { status: [] }, canonical: "" });
    expect(parse("").query.status).toEqual([]);
    expect(parse("?status=inactive").query.status).toEqual(["inactive"]);
  });

  it("drop an unknown status and keep the known ones", () => {
    expect(parse("?status=archived,inactive,bogus&sort=code")).toMatchObject({
      query: { status: ["inactive"], sort: "code" },
      canonical: "?status=inactive&sort=code"
    });
    expect(parse("?status=archived").canonical).toBe("");
  });

  it("take a date filter as a preset or an inclusive range", () => {
    expect(parse("?updated=week&created=2025-12-29..2026-01-04")).toMatchObject({
      query: { updated: "week", created: "2025-12-29..2026-01-04" },
      canonical: "?updated=week&created=2025-12-29..2026-01-04"
    });
  });

  it.each([
    ["a range ending before it starts", "2026-02-01..2026-01-31"],
    ["a day that does not exist", "2026-02-30..2026-03-01"],
    ["half a range", "2026-01-01.."],
    ["an unknown preset", "year"]
  ])("drop a date filter that is %s", (_name, value) => {
    const { query, canonical } = parse(`?updated=${value}&search=ops`);
    expect(query.updated).toBeUndefined();
    expect(query.search).toBe("ops");
    expect(canonical).toBe("?search=ops");
  });
});

describe("date filters", () => {
  it("read today in the reader's zone, not the server's", () => {
    // 17:30 UTC on 31 December is already 1 January in Jakarta
    const now = new Date("2025-12-31T17:30:00Z");
    expect(todayIn("Asia/Jakarta", now)).toBe("2026-01-01");
    expect(todayIn("UTC", now)).toBe("2025-12-31");
  });

  it("turn a preset into the days it covers, across a month and a year end", () => {
    expect(dateFilterRange("today", "2026-01-03")).toEqual({
      from: "2026-01-03",
      to: "2026-01-03"
    });
    expect(dateFilterRange("week", "2026-01-03")).toEqual({ from: "2025-12-28", to: "2026-01-03" });
    expect(dateFilterRange("week", "2026-03-02")).toEqual({ from: "2026-02-24", to: "2026-03-02" });
    expect(dateFilterRange("month", "2026-01-03")).toEqual({
      from: "2026-01-01",
      to: "2026-01-03"
    });
    expect(dateFilterRange(undefined, "2026-01-03")).toBeNull();
  });

  it("send the API a range in place of a preset", () => {
    expect(resolveDateFilter("week", "2026-01-03")).toBe("2025-12-28..2026-01-03");
    expect(resolveDateFilter("2025-11-01..2025-12-31", "2026-01-03")).toBe(
      "2025-11-01..2025-12-31"
    );
    expect(resolveDateFilter(undefined, "2026-01-03")).toBeUndefined();
  });

  it("keep a custom range that equals a preset as the preset", () => {
    const today = "2026-01-03";
    expect(dateFilterValue({ from: today, to: today }, today)).toBe("today");
    expect(dateFilterValue({ from: "2025-12-28", to: today }, today)).toBe("week");
    expect(dateFilterValue({ from: "2026-01-01", to: today }, today)).toBe("month");
    expect(dateFilterValue({ from: "2025-12-27", to: today }, today)).toBe(
      "2025-12-27..2026-01-03"
    );
  });
});

const base = "/master/divisions";

describe("listHref", () => {
  it("sets a parameter and drops the page, since the rows behind page 3 have changed", () => {
    const params = new URLSearchParams("search=ops&page=3");
    expect(listHref(base, params, { status: "active" })).toBe(
      "/master/divisions?search=ops&status=active"
    );
  });

  it("removes a parameter given null, and an empty string the same way", () => {
    const params = new URLSearchParams("search=ops&status=active");
    expect(listHref(base, params, { status: null })).toBe("/master/divisions?search=ops");
    expect(listHref(base, params, { search: "" })).toBe("/master/divisions?status=active");
  });

  it("keeps the other parameters when only the page changes, and leaves page 1 implicit", () => {
    const params = new URLSearchParams("status=active&sort=code");
    expect(listHref(base, params, { page: 2 })).toBe(
      "/master/divisions?status=active&sort=code&page=2"
    );
    expect(listHref(base, new URLSearchParams("page=2"), { page: 1 })).toBe("/master/divisions");
  });

  it("keeps the commas of a value filter readable", () => {
    expect(listHref(base, new URLSearchParams(), { status: "active,inactive" })).toBe(
      `${base}?status=active,inactive`
    );
  });

  it("does not change the parameters it was given", () => {
    const params = new URLSearchParams("page=3");
    listHref(base, params, { status: "active" });
    expect(params.toString()).toBe("page=3");
  });
});

describe("sortState", () => {
  it("marks the sorted column and offers the other direction", () => {
    const params = new URLSearchParams("sort=code&dir=asc&page=2");
    expect(sortState(base, params, { sort: "code", dir: "asc" }, "code")).toEqual({
      ariaSort: "ascending",
      href: "/master/divisions?sort=code&dir=desc"
    });
  });

  it("starts another column ascending", () => {
    const params = new URLSearchParams("sort=code&dir=desc");
    expect(sortState(base, params, { sort: "code", dir: "desc" }, "name")).toEqual({
      ariaSort: "none",
      href: "/master/divisions?sort=name&dir=asc"
    });
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("keeps the first, the last and the current page's neighbours, with gaps between", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
  });

  it("never draws a gap that hides only one page", () => {
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
  });
});

describe("showingRange", () => {
  it("counts the rows on the current page", () => {
    expect(showingRange({ page: 1, perPage: 25, total: 60 })).toEqual({ from: 1, to: 25 });
    expect(showingRange({ page: 3, perPage: 25, total: 60 })).toEqual({ from: 51, to: 60 });
  });

  it("shows nothing for an empty list", () => {
    expect(showingRange({ page: 1, perPage: 25, total: 0 })).toEqual({ from: 0, to: 0 });
  });

  it("shows nothing for a page past the end, rather than an impossible range", () => {
    expect(showingRange({ page: 4, perPage: 25, total: 60 })).toEqual({ from: 0, to: 0 });
  });
});

describe("toggleListValue", () => {
  const order = ["active", "inactive"];

  it("adds a value to a filter, keeping the order the list offers", () => {
    expect(toggleListValue(null, "inactive", order)).toBe("inactive");
    expect(toggleListValue("inactive", "active", order)).toBe("active,inactive");
  });

  it("drops a value that is already chosen, and the filter with its last value", () => {
    expect(toggleListValue("active,inactive", "active", order)).toBe("inactive");
    expect(toggleListValue("active", "active", order)).toBeNull();
  });

  it("reads the old `all` as no filter, and ignores a value the list doesn't offer", () => {
    expect(toggleListValue("all", "active", order)).toBe("active");
    expect(toggleListValue("archived", "active", order)).toBe("active");
  });
});

describe("countSummary", () => {
  const list = (page: number, total: number) => ({ page, perPage: 25, total });

  it("reads the range of an unfiltered list, and says so when there are none", () => {
    expect(countSummary(list(1, 60), "divisions", null)).toBe("Showing 1–25 of 60");
    expect(countSummary(list(1, 0), "divisions", null)).toBe("No divisions");
    expect(countSummary(list(4, 60), "divisions", null)).toBe(
      "60 divisions in all, none on this page"
    );
  });

  it("agrees the noun with its number, and names an unfiltered range when asked", () => {
    const trash = { one: "deleted division", many: "deleted divisions" };

    expect(countSummary(list(1, 1), trash, null, true)).toBe("Showing 1–1 of 1 deleted division");
    expect(countSummary(list(1, 60), trash, null, true)).toBe(
      "Showing 1–25 of 60 deleted divisions"
    );
    expect(countSummary(list(1, 60), trash, null)).toBe("Showing 1–25 of 60");
    expect(countSummary(list(1, 0), trash, null)).toBe("No deleted divisions");
    expect(countSummary(list(1, 1), trash, 1)).toBe("1 of 1 deleted division");
    expect(countSummary(list(1, 1), trash, 4)).toBe("1 of 4 deleted divisions");
    expect(countSummary(list(1, 40), trash, 60)).toBe(
      "Showing 1–25 of 40 · 60 deleted divisions in all"
    );
  });

  it("reads n of m when a search or filter narrows the list to one page", () => {
    expect(countSummary(list(1, 3), "divisions", 12)).toBe("3 of 12 divisions");
    expect(countSummary(list(1, 1), "divisions in the Trash", 4)).toBe(
      "1 of 4 divisions in the Trash"
    );
    expect(countSummary(list(1, 0), "divisions", 12)).toBe("0 of 12 divisions");
  });

  it("keeps the range on a filtered list that still pages, and adds what it was cut from", () => {
    expect(countSummary(list(2, 60), "divisions", 240)).toBe(
      "Showing 26–50 of 60 · 240 divisions in all"
    );
  });
});
