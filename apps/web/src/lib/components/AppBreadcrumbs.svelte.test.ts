import { describe, expect, it, vi } from "vitest";
import { page as browser } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the phone's hidden crumbs are styles.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import { trailFor } from "$lib/breadcrumbs.js";

vi.mock("$app/paths", () => ({ resolve: (path: string) => path }));

const { render } = await import("vitest-browser-svelte");
const { default: AppBreadcrumbs } = await import("./AppBreadcrumbs.svelte");

const finance = {
  label: "Finance",
  tile: { iconName: "heroicon-o-banknotes", colorHex: "#0f766e" }
};

describe("AppBreadcrumbs", () => {
  it("is a Breadcrumb navigation landmark holding an ordered list", async () => {
    await browser.viewport(1280, 800);
    const screen = await render(AppBreadcrumbs, {
      trail: trailFor("/master/divisions/d-1", finance)
    });

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    await expect.element(nav).toBeVisible();
    expect(nav.element().querySelector("ol")).not.toBeNull();
  });

  it("links every crumb before the last but the group, and marks the last as the page", async () => {
    await browser.viewport(1280, 800);
    const screen = await render(AppBreadcrumbs, {
      trail: trailFor("/master/divisions/d-1/edit", finance)
    });

    await expect
      .element(screen.getByRole("link", { name: "Divisions" }))
      .toHaveAttribute("href", "/master/divisions");
    await expect
      .element(screen.getByRole("link", { name: "Finance" }))
      .toHaveAttribute("href", "/master/divisions/d-1");
    expect(screen.getByRole("link").elements()).toHaveLength(2);
    await expect.element(screen.getByText("Master")).toBeVisible();
    expect(screen.getByRole("link", { name: "Master" }).elements()).toHaveLength(0);

    const current = screen.container.querySelector("[aria-current]");
    expect(current?.textContent?.trim()).toBe("Edit");
    expect(current?.getAttribute("aria-current")).toBe("page");
    expect(current?.closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
  });

  it("shows a Division's coloured tile and hides every icon from a screen reader", async () => {
    await browser.viewport(1280, 800);
    const screen = await render(AppBreadcrumbs, {
      trail: trailFor("/master/divisions/d-1", finance)
    });

    const tile = screen.container.querySelector<HTMLElement>("[style*='background-color']");
    expect(tile).not.toBeNull();
    for (const icon of screen.container.querySelectorAll("svg")) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
    expect(screen.container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a single crumb on the dashboard", async () => {
    await browser.viewport(1280, 800);
    const screen = await render(AppBreadcrumbs, { trail: trailFor("/") });

    expect(screen.container.querySelectorAll("li")).toHaveLength(1);
    expect(screen.container.querySelector("[aria-current='page']")?.textContent?.trim()).toBe(
      "Dashboard"
    );
  });

  it("keeps only the section on a phone, without overflowing it", async () => {
    await browser.viewport(390, 844);
    const screen = await render(AppBreadcrumbs, {
      trail: trailFor("/master/divisions/d-1/edit", finance)
    });

    await expect.element(screen.getByRole("link", { name: "Divisions" })).toBeVisible();
    await expect.element(screen.getByText("Master")).not.toBeVisible();
    await expect.element(screen.getByText("Finance")).not.toBeVisible();
    await expect.element(screen.getByText("Edit")).not.toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  it("passes axe in light and dark", async () => {
    await browser.viewport(1280, 800);
    const screen = await render(AppBreadcrumbs, {
      trail: trailFor("/master/divisions/d-1/edit", finance)
    });
    expect(await axeViolations(screen.container)).toEqual([]);

    document.documentElement.classList.add("dark");
    // Axe reads the colours it sees: wait out the links' colour transition.
    await expect.poll(() => document.getAnimations().length).toBe(0);
    expect(await axeViolations(screen.container)).toEqual([]);
    document.documentElement.classList.remove("dark");
  });
});
