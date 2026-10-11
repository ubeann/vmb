import { DivisionInputSchema, DivisionUpdateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
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

describe("DivisionForm on an edit", () => {
  const STAMP = "2026-01-05T01:10:00.123Z";
  const reloadHref = "/master/things/1/edit";
  const loaded = {
    name: "Operations",
    code: "OPS",
    description: "",
    colorHex: "#2563EB",
    iconName: "heroicon-o-cog-6-tooth",
    isActive: true
  };

  it("posts the updatedAt it loaded in a hidden field, with no conflict line", async () => {
    const form = await superValidate(
      { ...loaded, updatedAt: STAMP },
      zod4(DivisionUpdateInputSchema)
    );

    const screen = await render(DivisionForm, { form, reloadHref });

    const stamp = document.querySelector<HTMLInputElement>('input[name="updatedAt"]');
    expect(stamp?.type).toBe("hidden");
    expect(stamp?.value).toBe(STAMP);
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  });

  it("posts an empty field for a record that was never stamped", async () => {
    const form = await superValidate(
      { ...loaded, updatedAt: null },
      zod4(DivisionUpdateInputSchema)
    );

    await render(DivisionForm, { form, reloadHref });

    expect(document.querySelector<HTMLInputElement>('input[name="updatedAt"]')?.value).toBe("");
  });

  it("has no updatedAt field on a create", async () => {
    const form = await superValidate(zod4(DivisionInputSchema), { errors: false });

    await render(DivisionForm, { form });

    expect(document.querySelector('input[name="updatedAt"]')).toBeNull();
  });

  it("keeps the input and says the record changed, with a reload link, on a stale save", async () => {
    const form = await superValidate(
      { ...loaded, name: "My edit", updatedAt: STAMP },
      zod4(DivisionUpdateInputSchema)
    );
    setError(form, "updatedAt", "This record was changed by someone else since you opened it.");

    const screen = await render(DivisionForm, { form, reloadHref });

    await expect.element(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("alert").element().textContent).toContain(
      "Someone else changed this record since you opened it."
    );
    const reload = screen.getByRole("link", { name: "Reload" });
    await expect.element(reload).toHaveAttribute("href", reloadHref);
    await expect.element(reload).toHaveAttribute("data-sveltekit-reload");
    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("My edit");
    expect(document.querySelector<HTMLInputElement>('input[name="updatedAt"]')?.value).toBe(STAMP);
  });
});
