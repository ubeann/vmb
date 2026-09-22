import { DivisionInputSchema } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: DivisionForm } = await import("./DivisionForm.svelte");

describe("DivisionForm", () => {
  it("renders every legacy field, active by default", async () => {
    const form = await superValidate(zod4(DivisionInputSchema), { errors: false });
    form.data.isActive = true;

    const screen = await render(DivisionForm, { form });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Code (3–5 characters)" }))
      .toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Description" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Color" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Icon name" })).toBeVisible();
    await expect.element(screen.getByRole("checkbox", { name: "Active" })).toBeChecked();
    await expect.element(screen.getByRole("button", { name: "Save division" })).toBeVisible();
  });

  it("loads an existing record into the form", async () => {
    const form = await superValidate(
      {
        name: "Operations",
        code: "OPS",
        description: "Fleet and day-to-day operations",
        colorHex: "#2563EB",
        iconName: "heroicon-o-cog-6-tooth",
        isActive: false
      },
      zod4(DivisionInputSchema)
    );

    const screen = await render(DivisionForm, { form, submitLabel: "Update division" });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Operations");
    await expect
      .element(screen.getByRole("textbox", { name: "Code (3–5 characters)" }))
      .toHaveValue("OPS");
    await expect
      .element(screen.getByRole("textbox", { name: "Description" }))
      .toHaveValue("Fleet and day-to-day operations");
    await expect.element(screen.getByRole("checkbox", { name: "Active" })).not.toBeChecked();
    await expect.element(screen.getByRole("button", { name: "Update division" })).toBeVisible();
  });
});
