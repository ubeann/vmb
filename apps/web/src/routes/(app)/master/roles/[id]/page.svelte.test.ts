import type { RoleDetail } from "@vmb/types";
import { describe, expect, it } from "vitest";
import type { PageData } from "./$types.js";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const STAMP = "2026-10-05T03:04:00.123Z";
const ID = "d1000000-0000-4000-8000-000000000001";
const ALL = ["master-roles.view_any", "master-roles.update", "master-roles.delete"];

const role: RoleDetail = {
  id: ID,
  name: "Staff",
  isActive: true,
  isSystem: false,
  colorHex: "#805AD5",
  iconName: "user",
  description: null,
  divisionId: null,
  divisionName: null,
  createdAt: STAMP,
  updatedAt: STAMP
};

const pageData = (
  overrides: Partial<RoleDetail> = {},
  { permissions = ALL, confirmDelete = false } = {}
) => ({ role: { ...role, ...overrides }, permissions, confirmDelete }) as unknown as PageData;

describe("the role view page", () => {
  it("offers Edit and Delete… on an ordinary role", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await expect
      .element(screen.getByRole("link", { name: "Edit" }))
      .toHaveAttribute("href", `/master/roles/${ID}/edit`);
    // without JavaScript, Delete… opens the page's own question
    await expect
      .element(screen.getByRole("link", { name: "Delete…" }))
      .toHaveAttribute("href", `/master/roles/${ID}?delete`);
  });

  it("reads in the form's sections, with the division it applies to", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    const details = screen.getByRole("group", { name: "Details" });
    await expect.element(details.getByText(/No description/)).toBeVisible();
    await expect.element(details.getByText("Every division")).toBeVisible();
    const appearance = screen.getByRole("group", { name: "Appearance" });
    await expect.element(appearance.getByText("#805AD5")).toBeVisible();
    await expect.element(screen.getByText(/^Created/)).toBeVisible();
    await expect.element(screen.getByText("Active", { exact: true })).toBeVisible();
  });

  it("links to the users holding the role, for a caller who can list users", async () => {
    const screen = await render(Page, {
      data: pageData({}, { permissions: [...ALL, "master-users.view_any"] }),
      form: null
    });

    await expect
      .element(screen.getByRole("link", { name: "Users with this Role" }))
      .toHaveAttribute("href", `/master/users?role=${ID}`);
  });

  it("leaves the users link out for a caller who can't list users", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    expect(screen.getByRole("link", { name: "Users with this Role" }).elements()).toHaveLength(0);
  });

  it("names the division a role is scoped to", async () => {
    const screen = await render(Page, {
      data: pageData({ divisionId: ID, divisionName: "Warehouse" }),
      form: null
    });

    await expect.element(screen.getByText("Warehouse")).toBeVisible();
    expect(screen.getByText("Every division").elements()).toHaveLength(0);
  });

  it("explains a System Role, and offers neither Edit nor Delete, whatever the caller may do", async () => {
    const screen = await render(Page, {
      data: pageData({ isSystem: true }),
      form: null
    });

    await expect
      .element(
        screen.getByText(
          "This is a System Role. VMB depends on it, so it can't be edited or deleted."
        )
      )
      .toBeVisible();
    await expect.element(screen.getByText("System Role · Active")).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Delete…" }).elements()).toHaveLength(0);
    expect(document.querySelector('a[href$="/edit"]')).toBeNull();
  });

  it("offers Edit only with master-roles.update, Delete only with .delete", async () => {
    const screen = await render(Page, {
      data: pageData({}, { permissions: ["master-roles.view_any"] }),
      form: null
    });

    expect(screen.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Delete…" }).elements()).toHaveLength(0);
  });

  it("asks before a delete without JavaScript, as Delete permanently", async () => {
    const screen = await render(Page, {
      data: pageData({}, { confirmDelete: true }),
      form: null
    });

    const ask = screen.getByRole("region", { name: "Delete Staff permanently?" });
    await expect.element(ask).toBeVisible();
    await expect.element(ask.getByText("This can't be undone.")).toBeVisible();
    const submit = ask.getByRole("button", { name: "Delete permanently" });
    expect(submit.element().closest("form")?.getAttribute("action")).toBe("?/delete");
  });

  it("does not ask to delete a System Role even when the URL says so", async () => {
    const screen = await render(Page, {
      data: pageData({ isSystem: true }, { confirmDelete: true }),
      form: null
    });

    expect(screen.getByRole("region").elements()).toHaveLength(0);
  });

  it("opens the delete dialog from Delete… with JavaScript", async () => {
    const screen = await render(Page, { data: pageData(), form: null });

    await screen.getByRole("link", { name: "Delete…" }).click();

    await expect
      .element(screen.getByRole("dialog", { name: "Delete Staff permanently?" }))
      .toBeVisible();
  });

  it("says why a delete was refused while users hold the role, and where to go", async () => {
    const message = "3 users hold this role. Remove it from them first.";
    const screen = await render(Page, {
      data: pageData(),
      form: { error: message, code: "ROLE_IN_USE" }
    });

    await expect.element(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("alert").element().textContent).toContain(message);
    await expect
      .element(screen.getByRole("link", { name: "Go to Users" }))
      .toHaveAttribute("href", "/master/users");
  });

  it("offers no link to Users for another failure", async () => {
    const screen = await render(Page, {
      data: pageData(),
      form: { error: "Something went wrong. Please try again." }
    });

    await expect.element(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to Users" }).elements()).toHaveLength(0);
  });
});
