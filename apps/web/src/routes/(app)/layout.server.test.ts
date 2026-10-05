import { beforeEach, describe, expect, it, vi } from "vitest";

const withApiClientMock = vi.fn();
const getUserMock = vi.fn();
const getDivisionMock = vi.fn();

// The unit project runs without SvelteKit's Vite plugin, so `$lib` isn't a
// resolvable alias here — mock the specifiers the route itself imports.
vi.mock("$lib/api-access.js", () => ({
  withApiClient: (event: unknown, run: (client: unknown) => Promise<unknown>) =>
    withApiClientMock(event, run)
}));
vi.mock("$lib/components/ui/sidebar/constants.js", () => ({
  SIDEBAR_COOKIE_NAME: "sidebar_state"
}));
vi.mock("$lib/master/api.js", () => ({
  getUser: (...args: unknown[]) => getUserMock(...args),
  getDivision: (...args: unknown[]) => getDivisionMock(...args)
}));

const { load } = await import("./+layout.server.js");

const division = {
  id: "d-1",
  name: "Warehouse",
  code: "WH",
  description: null,
  colorHex: "#087c16",
  iconName: "heroicon-o-building-storefront",
  isActive: true
};

const event = (user: { id: string } | null = { id: "u-1" }, sidebarState?: string) =>
  ({
    locals: { user },
    cookies: { get: (name: string) => (name === "sidebar_state" ? sidebarState : undefined) }
  }) as never;

beforeEach(() => {
  withApiClientMock.mockReset();
  getUserMock.mockReset();
  getDivisionMock.mockReset();
  withApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run({})
    })
  );
  getUserMock.mockResolvedValue({ ok: true, value: { id: "u-1", divisionId: "d-1" } });
  getDivisionMock.mockResolvedValue({ ok: true, value: division });
});

describe("the app shell layout", () => {
  it("opens the sidebar unless its cookie says it was collapsed", async () => {
    await expect(load(event({ id: "u-1" }, "false"))).resolves.toMatchObject({
      sidebarOpen: false
    });
    await expect(load(event({ id: "u-1" }, "true"))).resolves.toMatchObject({ sidebarOpen: true });
  });

  it("hands the shell the division the signed-in user belongs to", async () => {
    await expect(load(event())).resolves.toEqual({
      division: { name: "Warehouse", iconName: "heroicon-o-building-storefront" },
      sidebarOpen: true
    });

    expect(getUserMock).toHaveBeenCalledWith({}, "u-1");
    expect(getDivisionMock).toHaveBeenCalledWith({}, "d-1");
  });

  it("reports no division for a user who has none, without asking for one", async () => {
    getUserMock.mockResolvedValue({ ok: true, value: { id: "u-1", divisionId: null } });

    await expect(load(event())).resolves.toEqual({ division: null, sidebarOpen: true });
    expect(getDivisionMock).not.toHaveBeenCalled();
  });

  it("reports no division when there is no session user", async () => {
    await expect(load(event(null))).resolves.toEqual({ division: null, sidebarOpen: true });
    expect(withApiClientMock).not.toHaveBeenCalled();
  });

  it("degrades to no division when the API is unreachable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    withApiClientMock.mockResolvedValue({ ok: false, error: new Error("down") });

    await expect(load(event())).resolves.toEqual({ division: null, sidebarOpen: true });

    expect(consoleError).toHaveBeenCalledWith(
      "app layout load: failed to reach the API",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it("degrades to no division when the API refuses the lookup", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getDivisionMock.mockResolvedValue({ ok: false, status: 404, error: "Division not found." });

    await expect(load(event())).resolves.toEqual({ division: null, sidebarOpen: true });

    expect(consoleError).toHaveBeenCalledWith(
      "app layout load: API refused the division lookup",
      "Division not found."
    );
    consoleError.mockRestore();
  });
});
