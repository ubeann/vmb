import { beforeEach, describe, expect, it, vi } from "vitest";

const withApiClientMock = vi.fn();
const getMyAccessMock = vi.fn();

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
  getMyAccess: (...args: unknown[]) => getMyAccessMock(...args)
}));

const { load } = await import("./+layout.server.js");

const division = { id: "d-1", name: "Warehouse", iconName: "heroicon-o-building-storefront" };

const event = (user: { id: string } | null = { id: "u-1" }, sidebarState?: string) =>
  ({
    locals: { user },
    cookies: { get: (name: string) => (name === "sidebar_state" ? sidebarState : undefined) }
  }) as never;

beforeEach(() => {
  withApiClientMock.mockReset();
  getMyAccessMock.mockReset();
  withApiClientMock.mockImplementation(
    async (_event: unknown, run: (client: unknown) => Promise<unknown>) => ({
      ok: true,
      value: await run({})
    })
  );
  getMyAccessMock.mockResolvedValue({
    ok: true,
    value: { permissions: ["master-users.view_any"], divisions: [division] }
  });
});

describe("the app shell layout", () => {
  it("opens the sidebar unless its cookie says it was collapsed", async () => {
    await expect(load(event({ id: "u-1" }, "false"))).resolves.toMatchObject({
      sidebarOpen: false
    });
    await expect(load(event({ id: "u-1" }, "true"))).resolves.toMatchObject({ sidebarOpen: true });
  });

  it("hands the shell the user's division and permissions", async () => {
    await expect(load(event())).resolves.toEqual({
      division: { name: "Warehouse", iconName: "heroicon-o-building-storefront" },
      permissions: ["master-users.view_any"],
      sidebarOpen: true
    });

    expect(getMyAccessMock).toHaveBeenCalledWith({});
  });

  it("reports no division for a user who has none", async () => {
    getMyAccessMock.mockResolvedValue({ ok: true, value: { permissions: [], divisions: [] } });

    await expect(load(event())).resolves.toEqual({
      division: null,
      permissions: [],
      sidebarOpen: true
    });
  });

  it("asks nothing when there is no session user", async () => {
    await expect(load(event(null))).resolves.toEqual({
      division: null,
      permissions: [],
      sidebarOpen: true
    });
    expect(withApiClientMock).not.toHaveBeenCalled();
  });

  it("degrades when the API is unreachable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    withApiClientMock.mockResolvedValue({ ok: false, error: new Error("down") });

    await expect(load(event())).resolves.toEqual({
      division: null,
      permissions: [],
      sidebarOpen: true
    });

    expect(consoleError).toHaveBeenCalledWith(
      "app layout load: failed to reach the API",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it("degrades when the API refuses the lookup", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getMyAccessMock.mockResolvedValue({
      ok: false,
      status: 500,
      code: "INTERNAL",
      error: "Something went wrong.",
      issues: []
    });

    await expect(load(event())).resolves.toEqual({
      division: null,
      permissions: [],
      sidebarOpen: true
    });

    expect(consoleError).toHaveBeenCalledWith(
      "app layout load: API refused the access lookup",
      "Something went wrong."
    );
    consoleError.mockRestore();
  });
});
