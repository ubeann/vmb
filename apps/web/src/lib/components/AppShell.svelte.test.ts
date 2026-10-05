import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the sidebar's responsive
// switch and axe's colour reads are styles.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

const mockPage = { url: new URL("http://localhost/") };

vi.mock("$app/paths", () => ({
  resolve: (path: string, params: Record<string, string> = {}) =>
    Object.entries(params).reduce((out, [key, value]) => out.replace(`[${key}]`, value), path)
}));
vi.mock("$app/state", () => ({ page: mockPage }));

const { render } = await import("vitest-browser-svelte");
const { modeStorageKey, resetMode } = await import("mode-watcher");
const { default: AppShell } = await import("./AppShell.svelte");

const body = createRawSnippet(() => ({ render: () => "<h1>Page body</h1>" }));

const user = { id: "u-1", name: "Siti Rahma", email: "siti@vmblogistics.id" };
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
  resetMode();
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

  it("opens the user's menu with their identity and division", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    await expect.element(screen.getByText("siti@vmblogistics.id")).toBeVisible();
    await expect.element(screen.getByText("Division", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("Warehouse").last()).toBeVisible();
  });

  it("says so when the user has no division", async () => {
    await desktop();
    const screen = await render(AppShell, props({ division: null }));

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    await expect.element(screen.getByText("No division").last()).toBeVisible();
  });

  it("signs out with a form post from the user's menu", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    const logOut = screen.getByRole("menuitem", { name: "Log out" });
    await expect.element(logOut).toBeVisible();
    const form = logOut.element().closest("form");
    expect(form?.method).toBe("post");
    expect(form?.getAttribute("action")).toBe("/logout");
  });

  it("chooses the theme from the user's menu without closing it", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();
    await expect
      .element(screen.getByRole("menuitemradio", { name: "System" }))
      .toHaveAttribute("aria-checked", "true");

    await screen.getByRole("menuitemradio", { name: "Dark" }).click();

    expect(localStorage.getItem(modeStorageKey.current)).toBe("dark");
    await expect
      .element(screen.getByRole("menuitemradio", { name: "Dark" }))
      .toHaveAttribute("aria-checked", "true");

    await screen.getByRole("menuitemradio", { name: "System" }).click();
    expect(localStorage.getItem(modeStorageKey.current)).toBe("system");
  });

  it("shows a pointer over the menu's actions", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    for (const target of [
      screen.getByRole("menuitem", { name: "Log out" }),
      screen.getByRole("menuitemradio", { name: "Dark" })
    ]) {
      expect(getComputedStyle(target.element()).cursor).toBe("pointer");
    }
  });

  it("rounds the account button into a circle on a phone and a roomy pill on desktop", async () => {
    await phone();
    const small = await render(AppShell, props());
    const circle = small.getByRole("button", { name: "Siti Rahma, account menu" }).element();
    const { width, height } = circle.getBoundingClientRect();

    expect(width).toBe(height);
    expect(parseFloat(getComputedStyle(circle).borderTopLeftRadius)).toBeGreaterThanOrEqual(
      height / 2
    );
    small.unmount();

    await desktop();
    const large = await render(AppShell, props());
    const pill = large.getByRole("button", { name: "Siti Rahma, account menu" }).element();

    expect(pill.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
  });

  it("underlines the top bar on a phone, where no panel edge parts it from the page", async () => {
    await phone();
    const small = await render(AppShell, props());

    expect(getComputedStyle(small.getByRole("banner").element()).borderBottomColor).not.toBe(
      "rgba(0, 0, 0, 0)"
    );
    small.unmount();

    await desktop();
    const large = await render(AppShell, props());

    expect(getComputedStyle(large.getByRole("banner").element()).borderBottomColor).toBe(
      "rgba(0, 0, 0, 0)"
    );
  });

  it("moves the logo from the bar into the menu sheet on a phone", async () => {
    await phone();
    const small = await render(AppShell, props());
    const logo = (screen: typeof small) =>
      screen.getByRole("link", { name: "VMB, go to the dashboard" });

    await expect.element(small.getByRole("banner").getByRole("link")).not.toBeInTheDocument();
    await small.getByRole("button", { name: "Toggle Sidebar" }).click();
    await expect.element(logo(small)).toBeVisible();
    small.unmount();

    await desktop();
    const large = await render(AppShell, props());

    await expect
      .element(large.getByRole("banner").getByRole("link", { name: "VMB, go to the dashboard" }))
      .toBeVisible();
  });

  it("says whether the sidebar toggle has opened the menu", async () => {
    await phone();
    const screen = await render(AppShell, props());
    const toggle = screen.getByRole("button", { name: "Toggle Sidebar" });

    await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("lifts the bar off the page once the page has scrolled under it", async () => {
    await desktop();
    const tall = createRawSnippet(() => ({ render: () => '<div style="height: 3000px"></div>' }));
    const screen = await render(AppShell, props({ children: tall }));
    const bar = screen.getByRole("banner").element();

    expect(bar.getAttribute("data-scrolled")).toBe("false");
    expect(getComputedStyle(bar).boxShadow).toBe("none");

    window.scrollTo(0, 200);
    await expect.poll(() => bar.getAttribute("data-scrolled")).toBe("true");
    await expect.poll(() => getComputedStyle(bar).boxShadow).not.toBe("none");
    await expect.poll(() => getComputedStyle(bar).borderBottomColor).not.toBe("rgba(0, 0, 0, 0)");

    window.scrollTo(0, 0);
    await expect.poll(() => bar.getAttribute("data-scrolled")).toBe("false");
  });

  it("keeps the account button clear of the top edge", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const button = screen.getByRole("button", { name: "Siti Rahma, account menu" }).element();

    expect(button.getBoundingClientRect().top).toBeGreaterThanOrEqual(7);
  });

  it("shows the page's content below the top bar", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await expect.element(screen.getByRole("banner")).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: "Page body" })).toBeVisible();
  });

  it("falls back to the generated bot until a photo loads", async () => {
    await desktop();
    const screen = await render(AppShell, props({ user: { ...user, image: "/missing.png" } }));

    const bots = screen
      .getByRole("button", { name: "Siti Rahma, account menu" })
      .element()
      .querySelectorAll("[data-slot='avatar-fallback'] img");
    expect([...bots].map((bot) => bot.getAttribute("src"))).toEqual([
      "/(app)/avatar/u-1?theme=light",
      "/(app)/avatar/u-1?theme=dark"
    ]);
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
    it(`has no axe violations in ${scheme} mode, with the user's menu open too`, async () => {
      await desktop();
      document.documentElement.classList.toggle("dark", scheme === "dark");
      const screen = await render(AppShell, props());

      await expect.element(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
      expect(await axeViolations(document.body)).toEqual([]);

      await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();
      await expect.element(screen.getByRole("menuitem", { name: "Log out" })).toBeVisible();
      // Axe reads the colours it sees: wait out the menu's fade-in.
      await expect
        .poll(
          () =>
            document.querySelector("[data-slot='dropdown-menu-content']")?.getAnimations().length
        )
        .toBe(0);
      expect(await axeViolations(document.body)).toEqual([]);
    });
  }
});
