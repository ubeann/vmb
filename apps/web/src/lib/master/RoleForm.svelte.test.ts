import { RoleInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: RoleForm } = await import("./RoleForm.svelte");

describe("RoleForm", () => {
  it("renders the role fields, active by default", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });
    form.data.isActive = true;

    const screen = await render(RoleForm, { form });

    await expect.element(screen.getByRole("textbox", { name: "Role name" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Description" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Theme color" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Icon name" })).toBeVisible();
    await expect.element(screen.getByRole("checkbox", { name: "Active" })).toBeChecked();
    await expect.element(screen.getByRole("button", { name: "Save role" })).toBeVisible();
  });

  it("loads an existing role into the form", async () => {
    const form = await superValidate(
      {
        name: "Manager Division",
        description: "Oversees division activities",
        colorHex: "#ED8936",
        iconName: "heroicon-o-building-office-2",
        isActive: true
      },
      zod4(RoleInputSchema)
    );

    const screen = await render(RoleForm, { form });

    await expect
      .element(screen.getByRole("textbox", { name: "Role name" }))
      .toHaveValue("Manager Division");
  });
});
