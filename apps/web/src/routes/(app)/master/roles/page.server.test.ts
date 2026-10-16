import { beforeEach, describe, expect, it, vi } from "vitest";

const withApiClientMock = vi.fn();
const listRolesMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers the route itself imports.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withApiClientMock(event, run)
}));
vi.mock("$lib/master/api.js", () => ({
  listRoles: (...args: unknown[]) => listRolesMock(...args),
  deleteRole: vi.fn()
}));
vi.mock("$lib/master/form-action.js", () => ({ runRowAction: vi.fn() }));

vi.mock("$lib/master/list.js", () => import("../../../../lib/master/list.js"));

const { load, actions } = await import("./+page.server.js");
const { runRowAction } = await import("$lib/master/form-action.js");
const { deleteRole } = await import("$lib/master/api.js");

const page = (total: number) => ({
  items: [],
  total,
  page: 1,
  perPage: 25,
  facets: { status: { active: total, inactive: 0 } }
});

const event = (search = "") =>
  ({ url: new URL(`https://vmb.test/master/roles${search}`) }) as never;

beforeEach(() => {
  withApiClientMock.mockReset();
  listRolesMock.mockReset();
  withApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run({})
    })
  );
});

describe("the roles list load", () => {
  it("loads the page the URL asks for, sorted by name by default, with no Trash", async () => {
    listRolesMock.mockResolvedValue({ ok: true, value: page(40) });

    const result = await load(event("?sort=updatedAt&dir=desc"));

    expect(result).toMatchObject({ roles: { total: 40 }, outOf: null });
    expect(result).not.toHaveProperty("trashCount");
    expect(listRolesMock).toHaveBeenCalledTimes(1);
    expect(listRolesMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ sort: "updatedAt", dir: "desc", perPage: 25, tz: "Asia/Jakarta" })
    );
    expect(listRolesMock.mock.calls[0]?.[1]).not.toHaveProperty("trashed");
  });

  it("sorts by name, ascending, with nothing in the URL", async () => {
    listRolesMock.mockResolvedValue({ ok: true, value: page(1) });

    await load(event());

    expect(listRolesMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ sort: "name", dir: "asc" })
    );
  });

  it('counts the list without the search and filters, for "n of m" in the footer', async () => {
    listRolesMock.mockImplementation(async (_client, query: { perPage: number }) => ({
      ok: true,
      value: query.perPage === 10 ? page(12) : page(3)
    }));

    const result = await load(event("?search=staff&status=active,inactive"));

    expect(result).toMatchObject({ roles: { total: 3 }, outOf: 12 });
    expect(listRolesMock).toHaveBeenCalledTimes(2);
    const unfiltered = listRolesMock.mock.calls[1]?.[1];
    expect(unfiltered).toMatchObject({ status: [], perPage: 10 });
    expect(unfiltered.search).toBeUndefined();
  });

  it("still opens the list when the unfiltered count fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    listRolesMock.mockImplementation(async (_client, query: { perPage: number }) =>
      query.perPage === 10
        ? { ok: false, status: 500, error: "boom" }
        : { ok: true, value: page(3) }
    );

    const result = await load(event("?search=staff"));

    expect(result).toMatchObject({ roles: { total: 3 }, outOf: null });
    consoleError.mockRestore();
  });

  it("sends a date preset as the days it means today in the reader's zone", async () => {
    vi.useFakeTimers({ now: new Date("2025-12-31T17:30:00Z"), toFake: ["Date"] });
    try {
      listRolesMock.mockResolvedValue({ ok: true, value: page(1) });

      const result = await load(event("?updated=week&created=2025-11-01..2025-11-30"));

      // 17:30 UTC on 31 December is 1 January in Jakarta
      expect(listRolesMock).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          updated: "2025-12-26..2026-01-01",
          created: "2025-11-01..2025-11-30"
        })
      );
      expect(result).toMatchObject({ query: { updated: "week" } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not redirect a several-status query whose comma arrives encoded", async () => {
    listRolesMock.mockResolvedValue({ ok: true, value: page(1) });

    await expect(load(event("?status=active%2Cinactive"))).resolves.toMatchObject({
      query: { status: ["active", "inactive"] }
    });
  });

  it("drops the retired access-level sort and the old active filter, and keeps the rest", async () => {
    await expect(load(event("?sort=level&active=inactive&search=ops"))).rejects.toMatchObject({
      status: 307,
      location: "/master/roles?search=ops"
    });
    expect(listRolesMock).not.toHaveBeenCalled();
  });

  it("drops an unknown status, and a trashed view the list does not have", async () => {
    await expect(load(event("?status=active,archived&trashed=only"))).rejects.toMatchObject({
      status: 307,
      location: "/master/roles?status=active"
    });
  });

  it("answers 403 when the API refuses the list", async () => {
    listRolesMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "You do not have permission to do that."
    });

    await expect(load(event())).rejects.toMatchObject({ status: 403 });
  });

  it("opens with no list when the API can't be reached", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    withApiClientMock.mockResolvedValue({ ok: false, error: new Error("down") });

    await expect(load(event())).resolves.toMatchObject({ roles: null });
    consoleError.mockRestore();
  });
});

describe("row actions", () => {
  it("delete removes the role through the API, with no restore to follow", async () => {
    vi.mocked(runRowAction).mockClear();
    await actions.delete!({} as never);

    const config = vi.mocked(runRowAction).mock.calls[0]![1];
    await config.run({} as never, "r1");
    expect(deleteRole).toHaveBeenCalledWith({}, "r1");
    expect(Object.keys(actions)).toEqual(["delete"]);
  });
});
