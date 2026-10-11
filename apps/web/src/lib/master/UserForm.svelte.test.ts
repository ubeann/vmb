import { UserCreateInputSchema, UserUpdateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
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

  it("shows the API's email conflict on the email field", async () => {
    const taken = "A user with that email already exists.";
    const form = await superValidate(
      { name: "Rina Wijaya", email: "rina@vmblogistics.id" },
      zod4(UserUpdateInputSchema)
    );
    // what `createMasterFormAction` does with the API's 409 CONFLICT issue on `email`
    setError(form, "email", taken);

    const screen = await render(UserForm, { form, roles });

    const message = screen.getByText(taken);
    await expect.element(message).toBeVisible();
    const field = message.element().closest("label")?.querySelector("input");
    expect(field?.getAttribute("name")).toBe("email");
  });
});

describe("UserForm on an edit", () => {
  const STAMP = "2026-01-05T01:10:00.123Z";
  const reloadHref = "/master/things/1/edit";
  const loaded = {
    name: "Rina Wijaya",
    email: "rina@vmblogistics.id",
    phone: "0811-1000-0001",
    roleIds: [],
    status: "active" as const,
    profilePhotoPath: "",
    password: "",
    passwordConfirmation: ""
  };

  it("posts the updatedAt it loaded in a hidden field, with no conflict line", async () => {
    const form = await superValidate({ ...loaded, updatedAt: STAMP }, zod4(UserUpdateInputSchema));

    const screen = await render(UserForm, { form, reloadHref, roles });

    const stamp = document.querySelector<HTMLInputElement>('input[name="updatedAt"]');
    expect(stamp?.type).toBe("hidden");
    expect(stamp?.value).toBe(STAMP);
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  });

  it("posts an empty field for a record that was never stamped", async () => {
    const form = await superValidate({ ...loaded, updatedAt: null }, zod4(UserUpdateInputSchema));

    await render(UserForm, { form, reloadHref, roles });

    expect(document.querySelector<HTMLInputElement>('input[name="updatedAt"]')?.value).toBe("");
  });

  it("has no updatedAt field on a create", async () => {
    const form = await superValidate(zod4(UserCreateInputSchema), { errors: false });

    await render(UserForm, { form, roles });

    expect(document.querySelector('input[name="updatedAt"]')).toBeNull();
  });

  it("keeps the input and says the record changed, with a reload link, on a stale save", async () => {
    const form = await superValidate(
      { ...loaded, name: "My edit", updatedAt: STAMP },
      zod4(UserUpdateInputSchema)
    );
    setError(form, "updatedAt", "This record was changed by someone else since you opened it.");

    const screen = await render(UserForm, { form, reloadHref, roles });

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
