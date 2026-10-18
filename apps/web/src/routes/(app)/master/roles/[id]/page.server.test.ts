import { beforeEach, describe, expect, it, vi } from "vitest";

const getRoleMock = vi.fn();
const loadDivisionOptionsMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers the routes themselves import.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
    ok: true,
    value: await run({})
  })
}));
vi.mock("$lib/master/api.js", () => ({
  getRole: (...args: unknown[]) => getRoleMock(...args),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  createRole: vi.fn(),
  pageErrorStatus: () => 404
}));
vi.mock("$lib/master/form-action.js", () => ({
  runRowAction: vi.fn(),
  createMasterFormAction: () => vi.fn()
}));
vi.mock("$lib/master/form-data.js", () => ({
  roleFormData: (role: unknown) => role,
  RoleFormSchema: {},
  RoleFormUpdateSchema: {}
}));
vi.mock("$lib/master/loads.js", async () => ({
  loadDivisionOptions: (...args: unknown[]) => loadDivisionOptionsMock(...args),
  divisionChoices: (await import("../../../../../lib/master/loads.js")).divisionChoices
}));
vi.mock("$lib/master/permissions.js", () => import("../../../../../lib/master/permissions.js"));
vi.mock("$lib/master/appearance.js", () => import("../../../../../lib/master/appearance.js"));
vi.mock("sveltekit-superforms/server", () => ({ superValidate: async () => ({ data: {} }) }));
vi.mock("sveltekit-superforms/adapters", () => ({ zod4: (schema: unknown) => schema }));

const view = await import("./+page.server.js");
const edit = await import("./edit/+page.server.js");
const create = await import("../new/+page.server.js");

const role = {
  id: "r-1",
  name: "Staff",
  isSystem: false,
  iconName: "user",
  colorHex: "#805AD5",
  permissionKeys: ["master-roles.view_any"],
  grantable: true
};

const ALL = ["master-roles.view_any", "master-roles.create", "master-roles.update"];

const eventFor = (permissions = ALL, url = "http://localhost/master/roles/r-1") =>
  ({
    params: { id: "r-1" },
    url: new URL(url),
    parent: async () => ({ permissions })
  }) as never;

const event = eventFor();

beforeEach(() => {
  getRoleMock.mockReset();
  getRoleMock.mockResolvedValue({ ok: true, value: role });
  loadDivisionOptionsMock.mockReset();
  loadDivisionOptionsMock.mockResolvedValue([]);
});

describe("a role's pages name it for the top bar's trail", () => {
  const crumb = {
    label: "Staff",
    tile: { iconName: "user", colorHex: "#805AD5" }
  };

  it("on the view page, with its name and icon tile", async () => {
    await expect(view.load(event)).resolves.toMatchObject({ role, crumb });
  });

  it("on the edit page, with its name and icon tile", async () => {
    await expect(edit.load(event)).resolves.toMatchObject({ role, crumb });
  });
});

describe("a role's edit route", () => {
  it("opens the form for an ordinary role", async () => {
    await expect(edit.load(event)).resolves.toMatchObject({ role });
  });

  it("is refused for a System Role, as the API refuses an edit of one", async () => {
    getRoleMock.mockResolvedValue({ ok: true, value: { ...role, isSystem: true } });

    await expect(edit.load(event)).rejects.toMatchObject({
      status: 403,
      body: { message: "System roles cannot be modified or deleted." }
    });
  });

  it("is refused for a role that grants what the caller lacks, as the API refuses its save", async () => {
    getRoleMock.mockResolvedValue({
      ok: true,
      value: {
        ...role,
        permissionKeys: ["master-roles.view_any", "master-users.delete"],
        grantable: false
      }
    });

    await expect(edit.load(event)).rejects.toMatchObject({
      status: 403,
      body: { message: "You cannot change a role that carries permissions you do not have." }
    });
  });

  it("still shows a System Role on its view page, which says why nothing can change", async () => {
    const system = { ...role, isSystem: true };
    getRoleMock.mockResolvedValue({ ok: true, value: system });

    await expect(view.load(event)).resolves.toMatchObject({ role: system });
  });
});

describe("a role's Division choices (#463)", () => {
  const hub = { id: "d-hub", name: "Hub", isActive: true };
  const depot = { id: "d-depot", name: "Depot", isActive: false };

  it("offers a new role the active Divisions only", async () => {
    loadDivisionOptionsMock.mockResolvedValue([hub, depot]);

    await expect(create.load(eventFor())).resolves.toMatchObject({
      divisions: [{ id: "d-hub", name: "Hub", inactive: false }]
    });
  });

  it("keeps an edited role's Inactive Division among the choices, marked, beside the active ones", async () => {
    loadDivisionOptionsMock.mockResolvedValue([hub, depot]);
    getRoleMock.mockResolvedValue({
      ok: true,
      value: { ...role, divisionId: "d-depot", divisionName: "Depot", divisionInactive: true }
    });

    await expect(edit.load(event)).resolves.toMatchObject({
      divisions: [
        { id: "d-depot", name: "Depot", inactive: true },
        { id: "d-hub", name: "Hub", inactive: false }
      ]
    });
  });

  it("still lists the role's own Division for a caller who cannot read Divisions", async () => {
    getRoleMock.mockResolvedValue({
      ok: true,
      value: { ...role, divisionId: "d-hub", divisionName: "Hub", divisionInactive: false }
    });

    await expect(edit.load(event)).resolves.toMatchObject({
      divisions: [{ id: "d-hub", name: "Hub", inactive: false }]
    });
  });
});

describe("a role's pages answer as the API does without the permission", () => {
  it("refuses the edit page without master-roles.update", async () => {
    await expect(edit.load(eventFor(["master-roles.view_any"]))).rejects.toMatchObject({
      status: 403,
      body: { message: "You do not have permission to do that." }
    });
    expect(getRoleMock).not.toHaveBeenCalled();
  });

  it("refuses the new page without master-roles.create", async () => {
    await expect(create.load(eventFor(["master-roles.view_any"]))).rejects.toMatchObject({
      status: 403
    });
  });

  it("opens the new page with master-roles.create, active and blue by default", async () => {
    await expect(create.load(eventFor())).resolves.toMatchObject({
      form: { data: { isActive: true, colorHex: "#2563EB" } }
    });
  });
});

describe("a role's view page without JavaScript", () => {
  it("asks before a delete when the URL says so", async () => {
    const asking = eventFor(ALL, "http://localhost/master/roles/r-1?delete");
    await expect(view.load(asking)).resolves.toMatchObject({ confirmDelete: true });
    await expect(view.load(event)).resolves.toMatchObject({ confirmDelete: false });
  });
});
