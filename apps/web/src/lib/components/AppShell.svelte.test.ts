import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the sidebar's responsive
// switch and axe's colour reads are styles.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

const mockPage = { url: new URL("http://localhost/") };

vi.mock("$app/paths", () => ({ resolve: (path: string) => path }));
vi.mock("$app/state", () => ({ page: mockPage }));

const { render } = await import("vitest-browser-svelte");
const { default: AppShell } = await import("./AppShell.svelte");

const body = createRawSnippet(() => ({ render: () => "<h1>Page body</h1>" }));

const user = { name: "Siti Rahma", email: "siti@vmblogistics.id" };
const division = { name: "Warehouse", iconName: "heroicon-o-building-storefront" };

const props = (overrides: Record<string, unknown> = {}) => ({
  user,
  division,
  sidebarOpen: true,
  children: body,
  ...overrides
});

const desktop = () => browser.viewport(1280, 800);
const phone = () => browser.viewport(390, 844);

afterEach(() => {
  mockPage.url = new URL("http://localhost/");
  document.documentElement.classList.remove("dark");
});

describe("AppShell", () => {
  it("lists the screens in the main navigation and marks the current one", async () => {
    await desktop();
    mockPage.url = new URL("http://localhost/master/users/new");
    const screen = await render(AppShell, props());

    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Dashboard", "Divisions", "Roles", "Users"]) {
      await expect.element(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect
      .element(nav.getByRole("link", { name: "Users" }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(nav.getByRole("link", { name: "Dashboard" }))
      .not.toHaveAttribute("aria-current");
  });

  it("shows who is signed in and their division", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await expect.element(screen.getByText("Siti Rahma")).toBeVisible();
    await expect.element(screen.getByText("Warehouse")).toBeVisible();
  });

  it("says so when the user has no division", async () => {
    await desktop();
    const screen = await render(AppShell, props({ division: null }));

    await expect.element(screen.getByText("No division")).toBeVisible();
  });

  it("signs out with a plain form post, so it works before scripts load", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    const logOut = screen.getByRole("button", { name: "Log out" });
    await expect.element(logOut).toBeVisible();
    const form = logOut.element().closest("form");
    expect(form?.method).toBe("post");
    expect(form?.getAttribute("action")).toBe("/logout");
  });

  it("carries the theme toggle and the page's content", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await expect.element(screen.getByRole("button", { name: "Theme" })).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: "Page body" })).toBeVisible();
  });

  it("keeps the navigation behind a toggle on a phone", async () => {
    await phone();
    const screen = await render(AppShell, props());

    await expect.element(screen.getByRole("link", { name: "Divisions" })).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Toggle Sidebar" }).click();

    await expect.element(screen.getByRole("link", { name: "Divisions" })).toBeVisible();
  });

  it("collapses to icons on desktop and opens again from the same toggle", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const sidebar = () => document.querySelector("[data-slot='sidebar'][data-state]");

    expect(sidebar()?.getAttribute("data-state")).toBe("expanded");
    await screen.getByRole("button", { name: "Toggle Sidebar" }).click();
    expect(sidebar()?.getAttribute("data-state")).toBe("collapsed");
    await userEvent.keyboard("{Control>}b{/Control}");
    expect(sidebar()?.getAttribute("data-state")).toBe("expanded");
  });

  it("starts collapsed when the saved state says so", async () => {
    await desktop();
    await render(AppShell, props({ sidebarOpen: false }));

    expect(
      document.querySelector("[data-slot='sidebar'][data-state]")?.getAttribute("data-state")
    ).toBe("collapsed");
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`has no axe violations in ${scheme} mode`, async () => {
      await desktop();
      document.documentElement.classList.toggle("dark", scheme === "dark");
      const screen = await render(AppShell, props());

      await expect.element(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
      expect(await axeViolations(document.body)).toEqual([]);
    });
  }
});
