import { describe, expect, it, vi } from "vitest";

// The unit project has no `$lib` alias: mock the specifier the route itself imports.
vi.mock("$lib/nav.js", () => import("../../../lib/nav.js"));

const route = await import("./+page.server.js");

// `redirect` throws, so what the load answers is what it threw
async function redirectedTo(permissions: string[]) {
  try {
    await route.load({ parent: async () => ({ permissions }) } as never);
  } catch (thrown) {
    const { status, location } = thrown as { status: number; location: string };
    return { status, location };
  }
  throw new Error("the load did not redirect");
}

describe("/master", () => {
  it("leads to the first list the caller may open, in the menu's order", async () => {
    await expect(redirectedTo(["master-users.view_any", "master-roles.view_any"])).resolves.toEqual(
      {
        status: 303,
        location: "/master/roles"
      }
    );
    await expect(redirectedTo(["master-users.view_any"])).resolves.toEqual({
      status: 303,
      location: "/master/users"
    });
    await expect(redirectedTo(["master-divisions.view_any"])).resolves.toEqual({
      status: 303,
      location: "/master/divisions"
    });
  });

  it("leads to the dashboard when the caller may open no list", async () => {
    await expect(redirectedTo([])).resolves.toEqual({ status: 303, location: "/" });
    await expect(redirectedTo(["master-users.view"])).resolves.toEqual({
      status: 303,
      location: "/"
    });
  });
});
