import { UserUpdateInputSchema, type Division } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: UserForm } = await import("./UserForm.svelte");

const divisions: Division[] = [
  {
    id: "d1000000-0000-4000-8000-000000000001",
    name: "Operations",
    code: "OPS",
    description: null,
    colorHex: "#2563EB",
    iconName: "heroicon-o-cog-6-tooth",
    isActive: true,
    createdAt: null,
    updatedAt: null,
    deletedAt: null
  }
];

describe("UserForm", () => {
  it("renders the legacy fields, divisions and statuses", async () => {
    const form = await superValidate(zod4(UserUpdateInputSchema));

    const screen = await render(UserForm, { form, divisions });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Phone (Indonesian, +62)" }))
      .toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Profile photo URL" })).toBeVisible();
    await expect.element(screen.getByRole("combobox", { name: "Division" })).toBeVisible();
    await expect.element(screen.getByRole("combobox", { name: "Status" })).toBeVisible();

    const divisionSelect = screen.getByRole("combobox", { name: "Division" }).elements()[0];
    const options = Array.from(divisionSelect?.querySelectorAll("option") ?? []).map((option) =>
      option.textContent?.trim()
    );
    expect(options).toEqual(["Choose a division", "Operations"]);

    const statusSelect = screen.getByRole("combobox", { name: "Status" }).elements()[0];
    const statuses = Array.from(statusSelect?.querySelectorAll("option") ?? []).map((option) =>
      option.textContent?.trim()
    );
    expect(statuses).toEqual(["Active", "Inactive", "Suspended"]);
  });

  it("asks for a password on create and offers keeping it on edit", async () => {
    const form = await superValidate(zod4(UserUpdateInputSchema));

    const created = await render(UserForm, { form, divisions, passwordRequired: true });
    await expect.element(created.getByRole("textbox", { name: /12–128 characters/ })).toBeVisible();

    const edited = await render(UserForm, { form, divisions });
    await expect
      .element(edited.getByRole("textbox", { name: /leave blank to keep the current password/ }))
      .toBeVisible();
  });
});
