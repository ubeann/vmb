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
vi.mock("sveltekit-superforms/server", () => ({ superValidate: async () => ({}) }));
vi.mock("sveltekit-superforms/adapters", () => ({ zod4: (schema: unknown) => schema }));

const view = await import("./+page.server.js");
const edit = await import("./edit/+page.server.js");

const division = {
  id: "d-1",
  name: "Finance",
  iconName: "heroicon-o-banknotes",
  colorHex: "#0f766e"
};

const event = { params: { id: "d-1" } } as never;

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
