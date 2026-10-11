import { RoleInputSchema, RoleUpdateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
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

describe("RoleForm on an edit", () => {
  const STAMP = "2026-01-05T01:10:00.123Z";
  const reloadHref = "/master/things/1/edit";
  const loaded = {
    name: "Staff",
    description: "",
    colorHex: "#805AD5",
    iconName: "heroicon-o-user",
    isActive: true
  };

  it("posts the updatedAt it loaded in a hidden field, with no conflict line", async () => {
    const form = await superValidate({ ...loaded, updatedAt: STAMP }, zod4(RoleUpdateInputSchema));

    const screen = await render(RoleForm, { form, reloadHref });

    const stamp = document.querySelector<HTMLInputElement>('input[name="updatedAt"]');
    expect(stamp?.type).toBe("hidden");
    expect(stamp?.value).toBe(STAMP);
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  });

  it("posts an empty field for a record that was never stamped", async () => {
    const form = await superValidate({ ...loaded, updatedAt: null }, zod4(RoleUpdateInputSchema));

    await render(RoleForm, { form, reloadHref });

    expect(document.querySelector<HTMLInputElement>('input[name="updatedAt"]')?.value).toBe("");
  });

  it("has no updatedAt field on a create", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });

    await render(RoleForm, { form });

    expect(document.querySelector('input[name="updatedAt"]')).toBeNull();
  });

  it("keeps the input and says the record changed, with a reload link, on a stale save", async () => {
    const form = await superValidate(
      { ...loaded, name: "My edit", updatedAt: STAMP },
      zod4(RoleUpdateInputSchema)
    );
    setError(form, "updatedAt", "This record was changed by someone else since you opened it.");

    const screen = await render(RoleForm, { form, reloadHref });

    await expect.element(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("alert").element().textContent).toContain(
      "Someone else changed this record since you opened it."
    );
    const reload = screen.getByRole("link", { name: "Reload" });
    await expect.element(reload).toHaveAttribute("href", reloadHref);
    await expect.element(reload).toHaveAttribute("data-sveltekit-reload");
    await expect.element(screen.getByRole("textbox", { name: "Role name" })).toHaveValue("My edit");
    expect(document.querySelector<HTMLInputElement>('input[name="updatedAt"]')?.value).toBe(STAMP);
  });
});
