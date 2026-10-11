import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

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
  pageErrorStatus: () => 404
}));
vi.mock("$lib/master/form-action.js", () => ({
  runRowAction: vi.fn(),
  createMasterFormAction: () => vi.fn()
}));
vi.mock("$lib/master/form-data.js", () => ({ userFormData: (user: unknown) => user }));
vi.mock("$lib/master/loads.js", () => ({
  loadRoleOptions: async () => [],
  mergeRoles: (options: unknown[]) => options
}));
vi.mock("sveltekit-superforms/server", () => ({ superValidate: async () => ({}) }));
vi.mock("sveltekit-superforms/adapters", () => ({ zod4: (schema: unknown) => schema }));

const edit = await import("./edit/+page.server.js");

const event = { params: { id: "u-1" } } as never;

beforeEach(() => {
  getUserMock.mockReset();
});

describe("a user's edit route", () => {
  it("opens the form for a live user", async () => {
    getUserMock.mockResolvedValue({
      ok: true,
      value: { id: "u-1", name: "Rina", roles: [], deletedAt: null }
    });

    await expect(edit.load(event)).resolves.toMatchObject({ crumb: { label: "Rina" } });
  });

  it("is not found for a Trashed user, as the API answers an edit of one", async () => {
    getUserMock.mockResolvedValue({
      ok: true,
      value: { id: "u-1", name: "Rina", roles: [], deletedAt: "2026-10-06T01:00:00.000Z" }
    });

    await expect(edit.load(event)).rejects.toMatchObject({ status: 404 });
  });
});
