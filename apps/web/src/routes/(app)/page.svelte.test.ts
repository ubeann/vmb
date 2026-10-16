import { describe, expect, it, vi } from "vitest";

// Isolated renders don't load the global stylesheet; axe reads real colours.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

vi.mock("$app/paths", () => ({ resolve: (path: string) => path }));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const health = { status: "ok", db: "connected", timestamp: "2026-01-01T00:00:00.000Z" };
const user = { id: "u-1", name: "Siti Rahma", email: "siti@vmblogistics.id" };
const division = { name: "Warehouse", iconName: "store" };

const data = (overrides: Record<string, unknown> = {}) => ({
  user,
  division,
  sidebarOpen: true,
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
  }
});
