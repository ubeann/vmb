import { UserCreateInputSchema, UserUpdateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { RoleOption } from "./loads.js";

const { render } = await import("vitest-browser-svelte");
const { default: UserForm } = await import("./UserForm.svelte");

const FINANCE = "c1000000-0000-4000-8000-000000000001";
const STAFF = "c1000000-0000-4000-8000-000000000002";
const HUB = "c1000000-0000-4000-8000-000000000003";

const roles: RoleOption[] = [
  { id: FINANCE, name: "Manager Finance", divisionName: "Finance", divisionInactive: false },
  { id: STAFF, name: "Staff", divisionName: null, divisionInactive: false },
  { id: HUB, name: "Hub staff", divisionName: "Hub", divisionInactive: true }
];

const posted = (name: string) =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)).map(
    (input) => input.value
  );

describe("UserForm", () => {
  it("has the legacy sections and fields, roles in a combobox and the statuses", async () => {
    const form = await superValidate(zod4(UserUpdateInputSchema));

    const screen = await render(UserForm, { form, roles, reloadHref: "/master/users/1/edit" });

    await expect.element(screen.getByRole("group", { name: "Personal details" })).toBeVisible();
    await expect.element(screen.getByRole("group", { name: "Authorization" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Phone number" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: /Photo link/ })).toBeVisible();
    await expect.element(screen.getByRole("combobox", { name: "Roles" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Status" })).toBeVisible();

    await screen.getByRole("button", { name: "Status" }).click();
    for (const status of ["Active", "Inactive", "Suspended"]) {
      await expect.element(screen.getByRole("option", { name: status })).toBeVisible();
    }
  });

  it("chooses roles by searching, shows each as a chip and posts their ids", async () => {
    const form = await superValidate(zod4(UserUpdateInputSchema));
    const screen = await render(UserForm, { form, roles });

    const field = screen.getByRole("combobox", { name: "Roles" });
    await field.click();
    // each option says its Division, and marks one that is Inactive
    const finance = screen.getByRole("option", { name: /Manager Finance/ });
    await expect.element(finance).toBeVisible();
    expect(finance.element().textContent).toMatch(/Manager Finance\s*Finance$/);
    const hub = screen.getByRole("option", { name: /Hub staff/ });
    await expect.element(hub).toBeVisible();
    expect(hub.element().textContent).toMatch(/Hub staff\s*Hub \(inactive\)$/);

    await userEvent.keyboard("fin");
    await expect.element(screen.getByRole("option", { name: /Staff/ })).not.toBeInTheDocument();
    await screen.getByRole("option", { name: /Manager Finance/ }).click();

    await expect
      .element(screen.getByRole("button", { name: "Remove the role Manager Finance" }))
      .toBeVisible();
    expect(posted("roleIds")).toEqual([FINANCE]);

    await screen.getByRole("button", { name: "Remove the role Manager Finance" }).click();
    expect(posted("roleIds")).toEqual([]);
  });

  it("takes the last role back on Backspace in the empty field", async () => {
    const form = await superValidate(
      { roleIds: [STAFF, FINANCE], status: "active" },
      zod4(UserUpdateInputSchema)
    );
    const screen = await render(UserForm, { form, roles });
    expect(posted("roleIds")).toEqual([STAFF, FINANCE]);

    await screen.getByRole("combobox", { name: "Roles" }).click();
    await userEvent.keyboard("{Escape}{Backspace}");

    expect(posted("roleIds")).toEqual([STAFF]);
  });

  it("asks for a password with its length reading on create only", async () => {
    const created = await render(UserForm, {
      form: await superValidate(zod4(UserCreateInputSchema), { errors: false }),
      roles,
      passwordRequired: true
    });
    await expect.element(created.getByRole("group", { name: "Security" })).toBeVisible();
    await expect.element(created.getByLabelText("Password", { exact: true })).toBeVisible();
    await expect.element(created.getByLabelText("Confirm password")).toBeVisible();
    await expect
      .element(created.getByRole("meter", { name: "Password length" }))
      .toBeInTheDocument();
    await expect.element(created.getByRole("button", { name: "Create user" })).toBeVisible();
    await created.unmount();

    const edited = await render(UserForm, {
      form: await superValidate(zod4(UserUpdateInputSchema)),
      roles,
      reloadHref: "/master/users/1/edit"
    });
    await expect.element(edited.getByRole("group", { name: "Security" })).not.toBeInTheDocument();
    expect(document.querySelector('input[name="password"]')).toBeNull();
    await expect.element(edited.getByRole("button", { name: "Save user" })).toBeVisible();
  });

  it("says what Suspended and Inactive do, beside the status", async () => {
    const screen = await render(UserForm, {
      form: await superValidate(zod4(UserUpdateInputSchema)),
      roles
    });

    await expect
      .element(screen.getByText(/can't sign in, and their sessions end when you save/))
      .toBeVisible();
  });

  it("asks before a save that takes an Active user out of Active, and keeps the form on Keep editing", async () => {
    const form = await superValidate(
      {
        name: "Rina Wijaya",
        email: "rina@vmblogistics.id",
        phone: "+628111000001",
        roleIds: [],
        status: "active",
        profilePhotoPath: "",
        password: "",
        passwordConfirmation: "",
        updatedAt: "2026-01-05T01:10:00.123Z"
      },
      zod4(UserUpdateInputSchema)
    );
    const screen = await render(UserForm, { form, roles, reloadHref: "/master/users/1/edit" });

    await screen.getByRole("button", { name: "Status" }).click();
    await screen.getByRole("option", { name: "Suspended" }).click();
    await screen.getByRole("button", { name: "Save user" }).click();

    const dialog = screen.getByRole("alertdialog", { name: "Make Rina Wijaya Suspended?" });
    await expect.element(dialog).toBeVisible();
    expect(dialog.element().textContent?.replace(/\s+/g, " ")).toContain(
      "Saving ends their sessions now"
    );

    await screen.getByRole("button", { name: "Keep editing" }).click();
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Rina Wijaya");
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
    const field = screen.getByRole("textbox", { name: "Email" });
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the API's refusal of an Inactive Division's role on the roles field", async () => {
    const refusal =
      "The role “Hub staff” is scoped to an Inactive Division and cannot be given to a user.";
    const form = await superValidate({ roleIds: [HUB] }, zod4(UserUpdateInputSchema));
    setError(form, "roleIds" as never, refusal);

    const screen = await render(UserForm, { form, roles });

    await expect.element(screen.getByText(refusal)).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Roles" }))
      .toHaveAttribute("aria-invalid", "true");
  });

  it("shows the escalation guard's message as the form's message", async () => {
    const message = "You cannot change a role that carries permissions you do not have.";
    const form = await superValidate(zod4(UserUpdateInputSchema));
    form.message = message;

    const screen = await render(UserForm, { form, roles });

    await expect.element(screen.getByRole("alert")).toHaveTextContent(message);
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
