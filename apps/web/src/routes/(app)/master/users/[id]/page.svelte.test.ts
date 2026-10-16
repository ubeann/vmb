import type { User } from "@vmb/types";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";
const ID = "d1000000-0000-4000-8000-000000000001";
const ALL = [
  "master-users.view_any",
  "master-users.update",
  "master-users.delete",
  "master-users.restore"
];

const user: User = {
  id: ID,
  name: "Rina Wijaya",
  status: "active",
  roles: [],
  divisions: [],
  phone: "+628111000001",
  email: "rina@vmblogistics.id",
  emailVerified: false,
  profilePhotoPath: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

const pageData = (
  overrides: Partial<User> = {},
  { permissions = ALL, confirmDelete = false } = {}
) => ({ user: { ...user, ...overrides }, permissions, confirmDelete }) as unknown as PageData;

describe("the user view page", () => {
  it("offers Edit and Delete… on a live user", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await expect
      .element(screen.getByRole("link", { name: "Edit" }))
      .toHaveAttribute("href", `/master/users/${ID}/edit`);
    // without JavaScript, Delete… opens the page's own question
    await expect
      .element(screen.getByRole("link", { name: "Delete…" }))
      .toHaveAttribute("href", `/master/users/${ID}?delete`);
  });

  it("reads in the form's three sections, with their roles and divisions", async () => {
    const screen = await render(Page, {
      data: pageData({
        roles: [
          { id: "r1", name: "Manager Finance" },
          { id: "r2", name: "Staff" }
        ],
        divisions: [{ id: "d1", name: "Finance" }],
        emailVerified: true
      }),
      form: null
    });

    const personal = screen.getByRole("group", { name: "Personal details" });
    await expect.element(personal.getByText("rina@vmblogistics.id")).toBeVisible();
    await expect.element(personal.getByText("+628111000001")).toBeVisible();
    const authorization = screen.getByRole("group", { name: "Authorization" });
    await expect.element(authorization.getByText("Manager Finance")).toBeVisible();
    await expect.element(authorization.getByText("Finance", { exact: true })).toBeVisible();
    await expect
      .element(screen.getByRole("group", { name: "Security" }).getByText("Verified"))
      .toBeVisible();
  });

  it("says a user has no roles, and so no division", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await expect.element(screen.getByText("No roles")).toBeVisible();
    await expect.element(screen.getByText("None, through their roles")).toBeVisible();
  });

  it("says the status in words in the header", async () => {
    const screen = await render(Page, { data: pageData({ status: "suspended" }), form: null });

    await expect.element(screen.getByText(/rina@vmblogistics.id · Suspended/)).toBeVisible();
  });

  it("offers neither Edit nor Delete… to a caller who may do neither", async () => {
    const screen = await render(Page, {
      data: pageData({}, { permissions: ["master-users.view_any"] }),
      form: null
    });

    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Delete…" }).elements()).toHaveLength(0);
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
    await expect.element(screen.getByText(/This user is in the Trash/)).toBeVisible();
  });

  it("asks on the page itself when the URL says Delete…, for a browser without JavaScript", async () => {
    const screen = await render(Page, {
      data: pageData({}, { confirmDelete: true }),
      form: null
    });

    await expect
      .element(screen.getByRole("heading", { name: "Delete Rina Wijaya?" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Cancel" }))
      .toHaveAttribute("href", `/master/users/${ID}`);
  });

  it("shows what the API refused", async () => {
    const screen = await render(Page, {
      data: pageData(),
      form: { error: "You cannot change a user who holds permissions you do not have." }
    });

    await expect.element(screen.getByRole("alert")).toBeVisible();
  });
});
