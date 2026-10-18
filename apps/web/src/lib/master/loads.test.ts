import { beforeEach, describe, expect, it, vi } from "vitest";

const withApiClientMock = vi.fn();
const listRolesMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers loads.ts imports.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withApiClientMock(event, run)
}));
vi.mock("$lib/master/api.js", () => ({
  listRoles: (...args: unknown[]) => listRolesMock(...args),
  listDivisions: vi.fn()
}));

const { divisionChoices, loadRoleFilterOptions } = await import("./loads.js");

const roles = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `id-${from + index}`,
    name: `Role ${from + index}`,
    isActive: true
  }));
const page = (items: unknown[], total: number) => ({ ok: true, value: { items, total } });

const event = {} as never;

beforeEach(() => {
  withApiClientMock.mockReset();
  listRolesMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  withApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run({})
    })
  );
});

describe("the Users list's Role filter options", () => {
  it("reads one page when every role fits on it, keeping only the id and the name", async () => {
    listRolesMock.mockResolvedValue(page(roles(1, 2), 2));

    await expect(loadRoleFilterOptions(event)).resolves.toEqual([
      { id: "id-1", name: "Role 1" },
      { id: "id-2", name: "Role 2" }
    ]);
    expect(listRolesMock).toHaveBeenCalledTimes(1);
    expect(listRolesMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ perPage: 100, page: 1 })
    );
  });

  it("follows the pages until it has every role, active or not", async () => {
    listRolesMock
      .mockResolvedValueOnce(page(roles(1, 100), 130))
      .mockResolvedValueOnce(page(roles(101, 30), 130));

    const options = await loadRoleFilterOptions(event);

    expect(options).toHaveLength(130);
    expect(listRolesMock).toHaveBeenCalledTimes(2);
    expect(listRolesMock.mock.calls[1]?.[1]).toMatchObject({ page: 2 });
    expect(listRolesMock.mock.calls[0]?.[1].status).toEqual([]);
  });

  it("gives none when the caller may not list roles, and the roles read so far when a later page fails", async () => {
    listRolesMock.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden" });
    await expect(loadRoleFilterOptions(event)).resolves.toEqual([]);

    listRolesMock.mockReset();
    listRolesMock
      .mockResolvedValueOnce(page(roles(1, 100), 130))
      .mockResolvedValueOnce({ ok: false, status: 500, error: "Boom" });
    await expect(loadRoleFilterOptions(event)).resolves.toHaveLength(100);
  });

  it("gives none when the API cannot be reached", async () => {
    withApiClientMock.mockResolvedValue({ ok: false, error: new Error("down") });

    await expect(loadRoleFilterOptions(event)).resolves.toEqual([]);
  });
});

describe("divisionChoices", () => {
  const division = (id: string, name: string, isActive = true) => ({ id, name, isActive }) as never;
  const all = [division("b", "Yard"), division("a", "Hub"), division("c", "Depot", false)];

  it("offers the active Divisions by name, and leaves out an Inactive one", () => {
    expect(divisionChoices(all, null)).toEqual([
      { id: "a", name: "Hub", inactive: false },
      { id: "b", name: "Yard", inactive: false }
    ]);
  });

  it("keeps the Division the role already has, marked Inactive when it is", () => {
    expect(divisionChoices(all, { id: "c", name: "Depot", inactive: true })).toEqual([
      { id: "c", name: "Depot", inactive: true },
      { id: "a", name: "Hub", inactive: false },
      { id: "b", name: "Yard", inactive: false }
    ]);
  });

  it("keeps a current Division the caller cannot list, or that is Trashed, once", () => {
    expect(divisionChoices([], { id: "t", name: "Old", inactive: true })).toEqual([
      { id: "t", name: "Old", inactive: true }
    ]);
    expect(divisionChoices(all, { id: "a", name: "Hub", inactive: false })).toHaveLength(2);
  });
});
