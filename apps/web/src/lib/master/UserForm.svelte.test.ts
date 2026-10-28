import { UserCreateInputSchema, UserUpdateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import type { RoleOption } from "./loads.js";

const { render } = await import("vitest-browser-svelte");
const { default: UserForm } = await import("./UserForm.svelte");

const FINANCE = "c1000000-0000-4000-8000-000000000001";
const STAFF = "c1000000-0000-4000-8000-000000000002";
const HUB = "c1000000-0000-4000-8000-000000000003";

const roles: RoleOption[] = [
  {
    id: FINANCE,
    name: "Manager Finance",
    isActive: true,
    divisionName: "Finance",
    divisionInactive: false,
    grantable: true
  },
  {
    id: STAFF,
    name: "Staff",
    isActive: true,
    divisionName: null,
    divisionInactive: false,
    grantable: true
  },
  {
    id: HUB,
    name: "Hub staff",
    isActive: true,
    divisionName: "Hub",
    divisionInactive: true,
    grantable: true
  }
];

// a role granting what the caller does not hold: theirs neither to give nor to take away
const ADMIN = "c1000000-0000-4000-8000-000000000004";
const superAdmin: RoleOption = {
  id: ADMIN,
  name: "Super Admin",
  isActive: true,
  divisionName: null,
  divisionInactive: false,
  grantable: false
};
const HINT = "You don't hold every permission this role grants";

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
    await expect.element(screen.getByRole("combobox", { name: "Status" })).toBeVisible();

    await screen.getByRole("combobox", { name: "Status" }).click();
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

  describe("a role the caller may not grant", () => {
    it("shows disabled in the list with the hint, and cannot be chosen", async () => {
      const form = await superValidate(zod4(UserUpdateInputSchema));
      const screen = await render(UserForm, { form, roles: [...roles, superAdmin] });

      await screen.getByRole("combobox", { name: "Roles" }).click();
      const option = screen.getByRole("option", { name: /Super Admin/ });
      await expect.element(option).toBeVisible();
      await expect.element(option).toHaveAttribute("aria-disabled", "true");
      await expect.element(option.getByText(HINT)).toBeVisible();
      // a role the caller may grant has no hint
      await expect
        .element(screen.getByRole("option", { name: /Staff/ }).getByText(HINT))
        .not.toBeInTheDocument();

      await option.click({ force: true });
      expect(posted("roleIds")).toEqual([]);
    });

    for (const scheme of ["light", "dark"] as const) {
      it(`has no axe violations in ${scheme} mode: the held chip, and the disabled option with its hint`, async () => {
        document.documentElement.classList.toggle("dark", scheme === "dark");
        const form = await superValidate(
          { roleIds: [ADMIN], status: "active" },
          zod4(UserUpdateInputSchema)
        );
        const other: RoleOption = {
          ...superAdmin,
          id: "c1000000-0000-4000-8000-000000000005",
          name: "Auditor"
        };
        const screen = await render(UserForm, { form, roles: [...roles, superAdmin, other] });

        const field = screen.getByRole("combobox", { name: "Roles" });
        const chip = document.querySelector("[data-slot=role-chip]");
        expect(await axeViolations(chip as Element)).toEqual([]);

        await field.click();
        const option = screen.getByRole("option", { name: /Auditor/ });
        await expect.element(option).toBeVisible();
        // axe is run on the option alone: the open list's own listbox and combobox findings
        // are the picker's, and there before this role was disabled
        await new Promise((done) => setTimeout(done, 400));
        expect(await axeViolations(option.element())).toEqual([]);
        document.documentElement.classList.remove("dark");
      });
    }

    it("is disabled on the create form too, where nobody holds anything yet", async () => {
      const form = await superValidate(zod4(UserCreateInputSchema), { errors: false });
      const screen = await render(UserForm, { form, roles: [superAdmin, ...roles] });

      await screen.getByRole("combobox", { name: "Roles" }).click();
      await expect
        .element(screen.getByRole("option", { name: /Super Admin/ }))
        .toHaveAttribute("aria-disabled", "true");
    });

    it("stays on a user who holds it, with no way to remove it, and the rest still can go", async () => {
      const form = await superValidate(
        { roleIds: [ADMIN, STAFF], status: "active" },
        zod4(UserUpdateInputSchema)
      );
      const screen = await render(UserForm, { form, roles: [...roles, superAdmin] });
      expect(posted("roleIds")).toEqual([ADMIN, STAFF]);

      // a chip with no remove button, saying why in words
      await expect
        .element(screen.getByRole("button", { name: "Remove the role Super Admin" }))
        .not.toBeInTheDocument();
      await expect
        .element(screen.getByText("Super Admin, which you can't remove"))
        .toBeInTheDocument();
      await screen.getByRole("button", { name: "Remove the role Staff" }).click();
      expect(posted("roleIds")).toEqual([ADMIN]);

      // Backspace in the empty field leaves it too, and so does choosing it from the list
      await screen.getByRole("combobox", { name: "Roles" }).click();
      await userEvent.keyboard("{Escape}{Backspace}");
      expect(posted("roleIds")).toEqual([ADMIN]);
      await screen.getByRole("combobox", { name: "Roles" }).click();
      await screen.getByRole("option", { name: /Super Admin/ }).click({ force: true });
      expect(posted("roleIds")).toEqual([ADMIN]);
    });
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

    await screen.getByRole("combobox", { name: "Status" }).click();
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
