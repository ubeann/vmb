import type { DivisionDetail } from "@vmb/types";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";
const ID = "d1000000-0000-4000-8000-000000000001";
const ALL = [
  "master-divisions.view_any",
  "master-divisions.update",
  "master-divisions.delete",
  "master-divisions.restore"
];

const division: DivisionDetail = {
  id: ID,
  name: "Operations",
  code: "OPS",
  description: null,
  colorHex: "#2563EB",
  iconName: "heroicon-o-cog-6-tooth",
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null,
  userCount: 12
};

const pageData = (
  overrides: Partial<DivisionDetail> = {},
  { permissions = ALL, confirmDelete = false } = {}
) =>
  ({ division: { ...division, ...overrides }, permissions, confirmDelete }) as unknown as PageData;

describe("the division view page", () => {
  it("offers Edit and Delete on a live division", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await expect
      .element(screen.getByRole("link", { name: "Edit" }))
      .toHaveAttribute("href", `/master/divisions/${ID}/edit`);
    // without JavaScript, Delete… opens the page's own question
    await expect
      .element(screen.getByRole("link", { name: "Delete…" }))
      .toHaveAttribute("href", `/master/divisions/${ID}?delete`);
    expect(screen.getByRole("button", { name: "Restore" }).elements()).toHaveLength(0);
  });

  it("says how many users are in it, linking to them", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await expect
      .element(screen.getByRole("link", { name: "12 users" }))
      .toHaveAttribute("href", `/master/users?divisionId=${ID}`);
  });

  it("offers Edit only with master-divisions.update, Delete only with .delete", async () => {
    const screen = await render(Page, {
      data: pageData({}, { permissions: ["master-divisions.view_any"] }),
      form: null
    });

    await expect.element(screen.getByText("OPS")).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Delete…" }).elements()).toHaveLength(0);
  });

  it("asks before a delete without JavaScript, saying it can come back from the Trash", async () => {
    const screen = await render(Page, {
      data: pageData({}, { confirmDelete: true }),
      form: null
    });

    const ask = screen.getByRole("region", { name: "Delete Operations?" });
    await expect.element(ask).toBeVisible();
    await expect
      .element(ask.getByText("It moves to the Trash. You can restore it from Trash."))
      .toBeVisible();
    const submit = ask.getByRole("button", { name: "Delete" });
    expect(submit.element().closest("form")?.getAttribute("action")).toBe("?/delete");
  });

  it("opens the delete dialog from Delete… with JavaScript", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await screen.getByRole("link", { name: "Delete…" }).click();

    await expect.element(screen.getByRole("dialog", { name: "Delete Operations?" })).toBeVisible();
  });

  it("says why a delete was refused while the division has roles, and where to go", async () => {
    const message =
      "2 roles belong to this division. Move them to another division or delete them first.";
    const screen = await render(Page, {
      data: pageData(),
      form: { error: message, code: "DIVISION_IN_USE" }
    });

    await expect.element(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("alert").element().textContent).toContain(message);
    await expect
      .element(screen.getByRole("link", { name: "Go to Roles" }))
      .toHaveAttribute("href", "/master/roles");
  });

  it("offers no link to Roles for another failure", async () => {
    const screen = await render(Page, {
      data: pageData(),
      form: { error: "Something went wrong. Please try again." }
    });

    await expect.element(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to Roles" }).elements()).toHaveLength(0);
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
    expect(screen.getByRole("link", { name: "Delete…" }).elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(document.querySelector('a[href$="/edit"]')).toBeNull();
    expect(document.querySelector("input:not([type=hidden]), textarea, select")).toBeNull();
  });
});
