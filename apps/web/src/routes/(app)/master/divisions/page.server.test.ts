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

const page = (total: number) => ({ items: [], total, page: 1, perPage: 25 });

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
  it("loads the page the URL asks for and counts the Trash beside it", async () => {
    listDivisionsMock.mockImplementation(async (_client, query: { trashed: string }) => ({
      ok: true,
      value: page(query.trashed === "only" ? 3 : 40)
    }));

    const result = await load(event("?search=ops&sort=code"));

    expect(result).toMatchObject({ divisions: { total: 40 }, trashCount: 3 });
    expect(listDivisionsMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ search: "ops", sort: "code", trashed: "exclude", perPage: 25 })
    );
    // the count ignores the filters: it is how much sits in the Trash, not how much matches
    expect(listDivisionsMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: "all", trashed: "only", page: 1 })
    );
  });

  it("still shows the list when only the count fails", async () => {
    listDivisionsMock.mockImplementation(async (_client, query: { trashed: string }) =>
      query.trashed === "only"
        ? { ok: false, status: 500, error: "Something went wrong. Please try again." }
        : { ok: true, value: page(40) }
    );

    await expect(load(event())).resolves.toMatchObject({
      divisions: { total: 40 },
      trashCount: null
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
