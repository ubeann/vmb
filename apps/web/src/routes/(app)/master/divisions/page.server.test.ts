import { beforeEach, describe, expect, it, vi } from "vitest";

const withApiClientMock = vi.fn();
const listDivisionsMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers the route itself imports.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withApiClientMock(event, run)
}));
vi.mock("$lib/master/api.js", () => ({
  listDivisions: (...args: unknown[]) => listDivisionsMock(...args),
  deleteDivision: vi.fn(),
  restoreDivision: vi.fn()
}));
vi.mock("$lib/master/form-action.js", () => ({ runRowAction: vi.fn() }));

vi.mock("$lib/master/list.js", () => import("../../../../lib/master/list.js"));

const { load } = await import("./+page.server.js");

const page = (total: number, trash = 0) => ({
  items: [],
  total,
  page: 1,
  perPage: 25,
  views: { all: total, trash },
  facets: { status: { active: total, inactive: 0 } }
});

const event = (search = "") =>
  ({ url: new URL(`https://vmb.test/master/divisions${search}`) }) as never;

beforeEach(() => {
  withApiClientMock.mockReset();
  listDivisionsMock.mockReset();
  withApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run({})
    })
  );
});

describe("the divisions list load", () => {
  it("loads the page the URL asks for, with the Trash count from the same answer", async () => {
    listDivisionsMock.mockResolvedValue({ ok: true, value: page(40, 3) });

    const result = await load(event("?sort=code"));

    expect(result).toMatchObject({ divisions: { total: 40 }, trashCount: 3, outOf: null });
    expect(listDivisionsMock).toHaveBeenCalledTimes(1);
    expect(listDivisionsMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sort: "code",
        trashed: "exclude",
        perPage: 25,
        tz: "Asia/Jakarta"
      })
    );
  });

  it('counts the view without the search and filters, for "n of m" in the footer', async () => {
    listDivisionsMock.mockImplementation(async (_client, query: { perPage: number }) => ({
      ok: true,
      value: query.perPage === 10 ? page(12) : page(3, 1)
    }));

    const result = await load(event("?search=ops&status=active,inactive&trashed=only"));

    expect(result).toMatchObject({ divisions: { total: 3 }, trashCount: 1, outOf: 12 });
    expect(listDivisionsMock).toHaveBeenCalledTimes(2);
    const unfiltered = listDivisionsMock.mock.calls[1]?.[1];
    expect(unfiltered).toMatchObject({ status: [], trashed: "only", perPage: 10 });
    expect(unfiltered.search).toBeUndefined();
  });

  it("still opens the list when the unfiltered count fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    listDivisionsMock.mockImplementation(async (_client, query: { perPage: number }) =>
      query.perPage === 10
        ? { ok: false, status: 500, error: "boom" }
        : { ok: true, value: page(3) }
    );

    const result = await load(event("?search=ops"));

    expect(result).toMatchObject({ divisions: { total: 3 }, outOf: null });
    consoleError.mockRestore();
  });

  it("sends a date preset as the days it means today in the reader's zone", async () => {
    vi.useFakeTimers({ now: new Date("2025-12-31T17:30:00Z"), toFake: ["Date"] });
    try {
      listDivisionsMock.mockResolvedValue({ ok: true, value: page(1) });

      const result = await load(event("?updated=week&created=2025-11-01..2025-11-30"));

      // 17:30 UTC on 31 December is 1 January in Jakarta
      expect(listDivisionsMock).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          updated: "2025-12-26..2026-01-01",
          created: "2025-11-01..2025-11-30"
        })
      );
      // the page keeps the preset, so its links stay relative
      expect(result).toMatchObject({ query: { updated: "week" } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the `include` view no tab offers to All", async () => {
    await expect(load(event("?trashed=include&search=ops"))).rejects.toMatchObject({
      status: 307,
      location: "/master/divisions?search=ops"
    });
    expect(listDivisionsMock).not.toHaveBeenCalled();
  });

  it("drops a parameter the list can't use and keeps the rest", async () => {
    await expect(load(event("?perPage=7&status=inactive"))).rejects.toMatchObject({
      status: 307,
      location: "/master/divisions?status=inactive"
    });
  });

  it("drops an unknown status or an invalid date range, and keeps the rest", async () => {
    await expect(
      load(event("?status=active,archived&updated=2026-02-01..2026-01-31&search=ops"))
    ).rejects.toMatchObject({
      status: 307,
      location: "/master/divisions?status=active&search=ops"
    });
  });

  it("still opens an old link that asks for every status", async () => {
    await expect(load(event("?status=all&search=ops"))).rejects.toMatchObject({
      location: "/master/divisions?search=ops"
    });
  });

  it("keeps the value of a repeated parameter that the list reads", async () => {
    await expect(load(event("?status=active&status=inactive"))).rejects.toMatchObject({
      location: "/master/divisions?status=inactive"
    });
  });

  it("answers 403 when the API refuses the list", async () => {
    listDivisionsMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "You do not have permission to do that."
    });

    await expect(load(event())).rejects.toMatchObject({ status: 403 });
  });
});
