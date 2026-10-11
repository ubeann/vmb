import type { User } from "@vmb/types";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";
const user: User = {
  id: "d1000000-0000-4000-8000-000000000001",
  name: "Rina Wijaya",
  status: "active",
  roles: [],
  phone: "+628111000001",
  email: "rina@vmblogistics.id",
  emailVerified: false,
  profilePhotoPath: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

const pageData = (overrides: Partial<User> = {}) =>
  ({ user: { ...user, ...overrides } }) as unknown as PageData;

describe("the user view page", () => {
  it("offers Edit and Delete on a live user", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await expect.element(screen.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("shows a Trashed user read-only, with Restore as its only action", async () => {
    const screen = await render(Page, {
      data: pageData({ deletedAt: "2026-10-06T01:00:00.000Z" }),
      form: null
    });

    await expect.element(screen.getByRole("button", { name: "Restore" })).toBeVisible();
    expect(screen.getByRole("button").elements()).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(document.querySelector('a[href$="/edit"]')).toBeNull();
  });
});
