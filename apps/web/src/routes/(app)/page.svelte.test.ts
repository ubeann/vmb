import { describe, expect, it, vi } from "vitest";

// Isolated renders don't load the global stylesheet; axe reads real colours.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

vi.mock("$app/paths", () => ({
  resolve: (path: string) => (path.startsWith("/") ? path : `/${path}`)
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const health = { status: "ok", db: "connected", timestamp: "2026-01-01T00:00:00.000Z" };
const user = { id: "u-1", name: "Siti Rahma", email: "siti@vmblogistics.id" };
const division = { name: "Warehouse", iconName: "store" };

const data = (overrides: Record<string, unknown> = {}) => ({
  user,
  division,
  sidebarOpen: true,
  permissions: ["master-divisions.view_any", "master-roles.view_any", "master-users.view_any"],
  health,
  ...overrides
});

describe("dashboard", () => {
  it("greets the signed-in user by first name", async () => {
    const screen = await render(Page, { data: data() } as never);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Hello, Siti" }))
      .toBeVisible();
  });

  it("shows who is signed in and their division", async () => {
    const screen = await render(Page, { data: data() } as never);

    await expect.element(screen.getByText("Siti Rahma")).toBeVisible();
    await expect.element(screen.getByText("siti@vmblogistics.id")).toBeVisible();
    await expect.element(screen.getByText("Warehouse")).toBeVisible();
  });

  it("says so when the user has no division", async () => {
    const screen = await render(Page, { data: data({ division: null }) } as never);

    await expect.element(screen.getByText("No division")).toBeVisible();
  });

  it("links to each master screen", async () => {
    const screen = await render(Page, { data: data() } as never);

    for (const [name, href] of [
      ["Divisions", "/master/divisions"],
      ["Roles", "/master/roles"],
      ["Users", "/master/users"]
    ]) {
      await expect
        .element(screen.getByRole("link", { name: new RegExp(`^${name}`) }))
        .toHaveAttribute("href", href);
    }
  });

  it("links only to the screens the caller may open", async () => {
    const screen = await render(Page, {
      data: data({ permissions: ["master-users.view_any", "master-roles.view"] })
    } as never);

    await expect
      .element(screen.getByRole("link", { name: /^Users/ }))
      .toHaveAttribute("href", "/master/users");
    await expect.element(screen.getByRole("link", { name: /^Divisions/ })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("link", { name: /^Roles/ })).not.toBeInTheDocument();
    await expect.element(screen.getByText("No screens to open yet")).not.toBeInTheDocument();
  });

  it("says when no screen is open to the caller, and names who can change that", async () => {
    const screen = await render(Page, { data: data({ permissions: [] }) } as never);

    await expect
      .element(screen.getByRole("heading", { name: "No screens to open yet" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Ask an administrator to give you a role", { exact: false }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("heading", { name: "Quick links" }))
      .not.toBeInTheDocument();
  });

  it("shows the API health status from page data", async () => {
    const screen = await render(Page, { data: data() } as never);

    await expect.element(screen.getByText("ok", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("connected", { exact: true })).toBeVisible();
  });

  it("shows the error status when the API is unreachable", async () => {
    const screen = await render(Page, {
      data: data({ health: { ...health, status: "error", db: "unreachable" } })
    } as never);

    await expect.element(screen.getByText("error", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("unreachable", { exact: true })).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`has no axe violations in ${scheme} mode`, async () => {
      document.documentElement.classList.toggle("dark", scheme === "dark");
      const screen = await render(Page, { data: data() } as never);

      await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await axeViolations(document.body)).toEqual([]);
      document.documentElement.classList.remove("dark");
    });

    it(`has no axe violations in ${scheme} mode with no screen to open`, async () => {
      document.documentElement.classList.toggle("dark", scheme === "dark");
      const screen = await render(Page, { data: data({ permissions: [] }) } as never);

      await expect
        .element(screen.getByRole("heading", { name: "No screens to open yet" }))
        .toBeVisible();
      expect(await axeViolations(document.body)).toEqual([]);
      document.documentElement.classList.remove("dark");
    });
  }
});
