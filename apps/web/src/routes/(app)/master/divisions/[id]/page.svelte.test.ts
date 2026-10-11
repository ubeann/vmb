import type { Division } from "@vmb/types";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";
const ID = "d1000000-0000-4000-8000-000000000001";
const division: Division = {
  id: ID,
  name: "Operations",
  code: "OPS",
  description: null,
  colorHex: "#2563EB",
  iconName: "heroicon-o-cog-6-tooth",
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

const pageData = (overrides: Partial<Division> = {}) =>
  ({ division: { ...division, ...overrides } }) as unknown as PageData;

describe("the division view page", () => {
  it("offers Edit and Delete on a live division", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await expect.element(screen.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Delete" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Restore" }).elements()).toHaveLength(0);
  });

  it("shows a Trashed division read-only, with Restore as its only action", async () => {
    const screen = await render(Page, {
      data: pageData({ deletedAt: "2026-10-06T01:00:00.000Z" }),
      form: null
    });

    await expect.element(screen.getByText("In the Trash. Restore it to change it.")).toBeVisible();
    await expect.element(screen.getByText("Operations", { exact: true }).first()).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Restore" })).toBeVisible();

    // the one button, no link to the edit route, and no Delete
    expect(screen.getByRole("button").elements()).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(document.querySelector('a[href$="/edit"]')).toBeNull();
    expect(document.querySelector("input:not([type=hidden]), textarea, select")).toBeNull();
  });
});
