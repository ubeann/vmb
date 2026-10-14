import { beforeEach, describe, expect, it, vi } from "vitest";

const getDivisionMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers the routes themselves import.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
    ok: true,
    value: await run({})
  })
}));
vi.mock("$lib/master/api.js", () => ({
  getDivision: (...args: unknown[]) => getDivisionMock(...args),
  updateDivision: vi.fn(),
  deleteDivision: vi.fn(),
  restoreDivision: vi.fn(),
  pageErrorStatus: () => 404
}));
vi.mock("$lib/master/form-action.js", () => ({
  runRowAction: vi.fn(),
  createMasterFormAction: () => vi.fn()
}));
vi.mock("$lib/master/form-data.js", () => ({
  divisionFormData: (division: unknown) => division
}));
vi.mock("$lib/master/permissions.js", () => import("../../../../../lib/master/permissions.js"));
vi.mock("sveltekit-superforms/server", () => ({ superValidate: async () => ({ data: {} }) }));
vi.mock("sveltekit-superforms/adapters", () => ({ zod4: (schema: unknown) => schema }));

const view = await import("./+page.server.js");
const edit = await import("./edit/+page.server.js");
const create = await import("../new/+page.server.js");

const division = {
  id: "d-1",
  name: "Finance",
  iconName: "heroicon-o-banknotes",
  colorHex: "#0f766e"
};

const ALL = ["master-divisions.view_any", "master-divisions.create", "master-divisions.update"];

const eventFor = (permissions = ALL, url = "http://localhost/master/divisions/d-1") =>
  ({
    params: { id: "d-1" },
    url: new URL(url),
    parent: async () => ({ permissions })
  }) as never;

const event = eventFor();

beforeEach(() => {
  getDivisionMock.mockReset();
  getDivisionMock.mockResolvedValue({ ok: true, value: division });
});

describe("a division's pages name it for the top bar's trail", () => {
  const crumb = {
    label: "Finance",
    tile: { iconName: "heroicon-o-banknotes", colorHex: "#0f766e" }
  };

  it("on the view page, with its name and icon tile", async () => {
    await expect(view.load(event)).resolves.toMatchObject({ division, crumb });
  });

  it("on the edit page, with its name and icon tile", async () => {
    await expect(edit.load(event)).resolves.toMatchObject({ division, crumb });
  });
});

describe("a division's edit route", () => {
  it("opens the form for a live division", async () => {
    await expect(edit.load(event)).resolves.toMatchObject({ division });
  });

  it("is not found for a Trashed division, as the API answers an edit of one", async () => {
    getDivisionMock.mockResolvedValue({
      ok: true,
      value: { ...division, deletedAt: "2026-10-06T01:00:00.000Z" }
    });

    await expect(edit.load(event)).rejects.toMatchObject({ status: 404 });
  });

  it("still shows a Trashed division on its view page, which is where Restore lives", async () => {
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    getDivisionMock.mockResolvedValue({ ok: true, value: trashed });

    await expect(view.load(event)).resolves.toMatchObject({ division: trashed });
  });
});

describe("a division's pages answer as the API does without the permission", () => {
  it("refuses the edit page without master-divisions.update", async () => {
    await expect(edit.load(eventFor(["master-divisions.view_any"]))).rejects.toMatchObject({
      status: 403,
      body: { message: "You do not have permission to do that." }
    });
    expect(getDivisionMock).not.toHaveBeenCalled();
  });

  it("refuses the new page without master-divisions.create", async () => {
    await expect(create.load(eventFor(["master-divisions.view_any"]))).rejects.toMatchObject({
      status: 403
    });
  });

  it("opens the new page with master-divisions.create, active by default", async () => {
    await expect(create.load(eventFor())).resolves.toMatchObject({
      form: { data: { isActive: true } }
    });
  });
});

describe("a division's view page without JavaScript", () => {
  it("asks before a delete when the URL says so", async () => {
    const asking = eventFor(ALL, "http://localhost/master/divisions/d-1?delete");
    await expect(view.load(asking)).resolves.toMatchObject({ confirmDelete: true });
    await expect(view.load(event)).resolves.toMatchObject({ confirmDelete: false });
  });
});
