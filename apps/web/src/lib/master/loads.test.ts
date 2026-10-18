import { beforeEach, describe, expect, it, vi } from "vitest";

const withApiClientMock = vi.fn();
const listRolesMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers loads.ts imports.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withApiClientMock(event, run)
}));
const listDivisionsMock = vi.fn();
vi.mock("$lib/master/api.js", () => ({
  listRoles: (...args: unknown[]) => listRolesMock(...args),
  listDivisions: (...args: unknown[]) => listDivisionsMock(...args)
}));

const { divisionChoices, loadRoleFilterOptions, loadRoleOptions, roleChoices } =
  await import("./loads.js");

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
  listDivisionsMock.mockReset();
  listDivisionsMock.mockResolvedValue({ ok: true, value: { items: [], total: 0 } });
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

describe("the user form's role options", () => {
  const role = (overrides: Record<string, unknown>) => ({
    id: "r-1",
    name: "Staff",
    isActive: true,
    divisionId: null,
    grantable: true,
    ...overrides
  });

  it("reads every role, inactive ones too, and says which the caller may grant", async () => {
    listRolesMock.mockResolvedValue(
      page(
        [
          role({ id: "r-1", name: "Staff" }),
          role({ id: "r-2", name: "Super Admin", grantable: false }),
          role({ id: "r-3", name: "Retired", isActive: false })
        ],
        3
      )
    );

    const options = await loadRoleOptions(event);

    expect(listRolesMock.mock.calls[0]?.[1].status).toEqual([]);
    expect(options).toEqual([
      expect.objectContaining({ id: "r-1", isActive: true, grantable: true }),
      expect.objectContaining({ id: "r-2", isActive: true, grantable: false }),
      expect.objectContaining({ id: "r-3", isActive: false, grantable: true })
    ]);
  });

  it("follows the pages, so an active role past the first hundred is still offered", async () => {
    listRolesMock
      .mockResolvedValueOnce(
        page(
          Array.from({ length: 100 }, (_, index) => role({ id: `old-${index}`, isActive: false })),
          101
        )
      )
      .mockResolvedValueOnce(page([role({ id: "late", name: "Late" })], 101));

    const options = await loadRoleOptions(event);

    expect(listRolesMock).toHaveBeenCalledTimes(2);
    expect(options).toHaveLength(101);
    expect(options.at(-1)).toMatchObject({ id: "late", isActive: true });
  });

  it("names a role's Division and whether it is inactive", async () => {
    listDivisionsMock.mockResolvedValue({
      ok: true,
      value: { items: [{ id: "d-1", name: "Hub", isActive: false }], total: 1 }
    });
    listRolesMock.mockResolvedValue(page([role({ divisionId: "d-1" })], 1));

    await expect(loadRoleOptions(event)).resolves.toEqual([
      expect.objectContaining({ divisionName: "Hub", divisionInactive: true })
    ]);
  });
});

describe("the roles a user form offers", () => {
  const option = (overrides: Record<string, unknown>) => ({
    id: "r-1",
    name: "Staff",
    isActive: true,
    divisionName: null,
    divisionInactive: false,
    grantable: true,
    ...overrides
  });

  it("offers an active role, and an inactive one or one of an Inactive Division only to who holds it", () => {
    const options = [
      option({ id: "r-a", name: "Active" }),
      option({ id: "r-i", name: "Inactive", isActive: false }),
      option({ id: "r-h", name: "Hub", divisionInactive: true })
    ];

    expect(roleChoices(options, []).map((role) => role.id)).toEqual(["r-a"]);
    expect(
      roleChoices(options, [
        { id: "r-i", name: "Inactive" },
        { id: "r-h", name: "Hub" }
      ]).map((role) => role.id)
    ).toEqual(["r-a", "r-h", "r-i"]);
  });

  it("keeps an ungrantable role in the list, for the form to disable", () => {
    const [kept] = roleChoices([option({ grantable: false })], []);

    expect(kept).toMatchObject({ id: "r-1", grantable: false });
  });

  it("takes a held role the options did not return as grantable: the API decides", () => {
    expect(roleChoices([], [{ id: "r-gone", name: "Retired" }])).toEqual([
      {
        id: "r-gone",
        name: "Retired",
        isActive: true,
        divisionName: null,
        divisionInactive: false,
        grantable: true
      }
    ]);
  });
});
