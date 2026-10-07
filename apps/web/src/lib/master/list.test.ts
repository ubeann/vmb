import { describe, expect, it } from "vitest";
import { listHref, pageWindow, showingRange, sortState } from "./list.js";

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
});
