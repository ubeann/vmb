import { RoleInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: RoleForm } = await import("./RoleForm.svelte");

describe("RoleForm", () => {
  it("renders the legacy fields and every access level, active by default", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });
    form.data.isActive = true;

    const screen = await render(RoleForm, { form });

    await expect.element(screen.getByRole("textbox", { name: "Role name" })).toBeVisible();
    await expect.element(screen.getByRole("combobox", { name: "Access level" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Description" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Theme color" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Icon name" })).toBeVisible();
    await expect.element(screen.getByRole("checkbox", { name: "Active" })).toBeChecked();
    await expect.element(screen.getByRole("button", { name: "Save role" })).toBeVisible();

    const select = screen.getByRole("combobox", { name: "Access level" }).elements()[0];
    const options = Array.from(select?.querySelectorAll("option") ?? []).map((option) =>
      option.textContent?.trim()
    );
    expect(options).toEqual([
      "Basic Access",
      "Supervisor Access",
      "Manager Access",
      "Administrator Access"
    ]);
  });

  it("loads an existing role's level into the select", async () => {
    const form = await superValidate(
      {
        name: "Manager Division",
        level: 2,
        description: "Oversees division activities",
        colorHex: "#ED8936",
        iconName: "heroicon-o-building-office-2",
        isActive: true
      },
      zod4(RoleInputSchema)
    );

    const screen = await render(RoleForm, { form });

    await expect.element(screen.getByRole("combobox", { name: "Access level" })).toHaveValue("2");
    await expect
      .element(screen.getByRole("textbox", { name: "Role name" }))
      .toHaveValue("Manager Division");
  });
});
