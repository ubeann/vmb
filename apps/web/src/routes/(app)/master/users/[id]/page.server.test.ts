import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const loadRoleOptionsMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers the routes themselves import.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
    ok: true,
    value: await run({})
  })
}));
vi.mock("$lib/master/api.js", () => ({
  getUser: (...args: unknown[]) => getUserMock(...args),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  restoreUser: vi.fn(),
  createUser: vi.fn(),
  pageErrorStatus: () => 404
}));
vi.mock("$lib/master/form-action.js", () => ({
  runRowAction: vi.fn(),
  createMasterFormAction: () => vi.fn()
}));
vi.mock("$lib/master/form-data.js", () => ({ userFormData: (user: unknown) => user }));
vi.mock("$lib/master/loads.js", async () => ({
  loadRoleOptions: (...args: unknown[]) => loadRoleOptionsMock(...args),
  roleChoices: (await import("../../../../../lib/master/loads.js")).roleChoices
}));
vi.mock("$lib/master/permissions.js", () => import("../../../../../lib/master/permissions.js"));
vi.mock("sveltekit-superforms/server", () => ({ superValidate: async () => ({ data: {} }) }));
vi.mock("sveltekit-superforms/adapters", () => ({ zod4: (schema: unknown) => schema }));

const view = await import("./+page.server.js");
const edit = await import("./edit/+page.server.js");
const create = await import("../new/+page.server.js");

const ALL = ["master-users.view_any", "master-users.create", "master-users.update"];

const eventFor = (permissions = ALL, url = "http://localhost/master/users/u-1") =>
  ({
    params: { id: "u-1" },
    url: new URL(url),
    parent: async () => ({ permissions })
  }) as never;

const event = eventFor();

const live = { id: "u-1", name: "Rina", roles: [], deletedAt: null };

beforeEach(() => {
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ ok: true, value: live });
  loadRoleOptionsMock.mockReset();
  loadRoleOptionsMock.mockResolvedValue([]);
});

describe("a user's pages name them for the top bar's trail", () => {
  it("on the view page and the edit page", async () => {
    await expect(view.load(event)).resolves.toMatchObject({ crumb: { label: "Rina" } });
    await expect(edit.load(event)).resolves.toMatchObject({ crumb: { label: "Rina" } });
  });
});

describe("a user's edit route", () => {
  it("opens the form for a live user", async () => {
    await expect(edit.load(event)).resolves.toMatchObject({ crumb: { label: "Rina" } });
  });

  it("is not found for a Trashed user, as the API answers an edit of one", async () => {
    getUserMock.mockResolvedValue({
      ok: true,
      value: { ...live, deletedAt: "2026-10-06T01:00:00.000Z" }
    });

    await expect(edit.load(event)).rejects.toMatchObject({ status: 404 });
  });

  it("offers a role of an Inactive Division only to the user who holds it", async () => {
    const hub = { id: "r-hub", name: "Hub staff", divisionName: "Hub", divisionInactive: true };
    const staff = { id: "r-staff", name: "Staff", divisionName: null, divisionInactive: false };
    loadRoleOptionsMock.mockResolvedValue([hub, staff]);

    const other = await edit.load(event);
    expect((other as { roles: { id: string }[] }).roles.map((role) => role.id)).toEqual([
      "r-staff"
    ]);

    getUserMock.mockResolvedValue({
      ok: true,
      value: { ...live, roles: [{ id: "r-hub", name: "Hub staff" }] }
    });
    const holder = await edit.load(event);
    expect((holder as { roles: { id: string }[] }).roles.map((role) => role.id)).toEqual([
      "r-hub",
      "r-staff"
    ]);
  });

  it("keeps a role the user holds that the options did not return", async () => {
    getUserMock.mockResolvedValue({
      ok: true,
      value: { ...live, roles: [{ id: "r-gone", name: "Retired" }] }
    });

    const loaded = await edit.load(event);
    expect((loaded as { roles: { id: string }[] }).roles.map((role) => role.id)).toEqual([
      "r-gone"
    ]);
  });
});

describe("a new user's route", () => {
  it("offers no role of an Inactive Division", async () => {
    loadRoleOptionsMock.mockResolvedValue([
      { id: "r-hub", name: "Hub staff", divisionName: "Hub", divisionInactive: true },
      { id: "r-staff", name: "Staff", divisionName: null, divisionInactive: false }
    ]);

    const loaded = await create.load(eventFor());
    expect((loaded as { roles: { id: string }[] }).roles.map((role) => role.id)).toEqual([
      "r-staff"
    ]);
  });
});

describe("a user's pages answer as the API does without the permission", () => {
  it("refuses the edit page without master-users.update", async () => {
    await expect(edit.load(eventFor(["master-users.view_any"]))).rejects.toMatchObject({
      status: 403,
      body: { message: "You do not have permission to do that." }
    });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("refuses the new page without master-users.create", async () => {
    await expect(create.load(eventFor(["master-users.view_any"]))).rejects.toMatchObject({
      status: 403
    });
  });
});

describe("a user's view page without JavaScript", () => {
  it("asks before a delete when the URL says so", async () => {
    const asking = eventFor(ALL, "http://localhost/master/users/u-1?delete");
    await expect(view.load(asking)).resolves.toMatchObject({ confirmDelete: true });
    await expect(view.load(event)).resolves.toMatchObject({ confirmDelete: false });
  });
});
