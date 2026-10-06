import { UserUpdateInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: UserForm } = await import("./UserForm.svelte");

const roles = [
  { id: "c1000000-0000-4000-8000-000000000001", name: "Manager Finance" },
  { id: "c1000000-0000-4000-8000-000000000002", name: "Staff" }
];

describe("UserForm", () => {
  it("renders the legacy fields, a checkbox per role and the statuses", async () => {
    const form = await superValidate(zod4(UserUpdateInputSchema));

    const screen = await render(UserForm, { form, roles });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Phone (Indonesian, +62)" }))
      .toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Profile photo URL" })).toBeVisible();
    await expect.element(screen.getByRole("checkbox", { name: "Manager Finance" })).toBeVisible();
    await expect.element(screen.getByRole("checkbox", { name: "Staff" })).not.toBeChecked();
    await expect.element(screen.getByRole("combobox", { name: "Status" })).toBeVisible();

    const statusSelect = screen.getByRole("combobox", { name: "Status" }).elements()[0];
    const statuses = Array.from(statusSelect?.querySelectorAll("option") ?? []).map((option) =>
      option.textContent?.trim()
    );
    expect(statuses).toEqual(["Active", "Inactive", "Suspended"]);
  });

  it("asks for a password on create and offers keeping it on edit", async () => {
    const form = await superValidate(zod4(UserUpdateInputSchema));

    const created = await render(UserForm, { form, roles, passwordRequired: true });
    await expect.element(created.getByRole("textbox", { name: /12–128 characters/ })).toBeVisible();

    const edited = await render(UserForm, { form, roles });
    await expect
      .element(edited.getByRole("textbox", { name: /leave blank to keep the current password/ }))
      .toBeVisible();
  });
});
