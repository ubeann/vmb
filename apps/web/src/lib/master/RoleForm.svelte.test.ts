// Isolated renders don't load the global stylesheet; axe reads the colours it sees.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import { RoleInputSchema, RoleUpdateInputSchema, allPermissionKeys } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

// A refused submit ends in SvelteKit's applyAction, which needs the running
// app an isolated render doesn't start
vi.mock("$app/forms", async (original) => ({
  ...(await original<typeof import("$app/forms")>()),
  applyAction: vi.fn()
}));

const { render } = await import("vitest-browser-svelte");
const { default: RoleForm } = await import("./RoleForm.svelte");
const { RoleFormSchema, RoleFormUpdateSchema } = await import("./form-data.js");

// a caller who holds every key, unless a test says otherwise
const HELD = allPermissionKeys();

describe("RoleForm", () => {
  it("renders the role fields, active by default, with one primary action", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });
    form.data.isActive = true;

    const screen = await render(RoleForm, { held: HELD, divisions: [], form });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Description (optional)" }))
      .toBeVisible();
    await expect.element(screen.getByRole("group", { name: "Color" })).toBeVisible();
    await expect.element(screen.getByRole("group", { name: "Icon", exact: true })).toBeVisible();
    await expect.element(screen.getByRole("switch", { name: "Active" })).toBeChecked();
    await expect.element(screen.getByRole("button", { name: "Save role" })).toBeVisible();
    expect(document.querySelectorAll("button[type=submit]")).toHaveLength(1);
  });

  it("loads an existing role into the form", async () => {
    const form = await superValidate(
      {
        name: "Manager Division",
        description: "Oversees division activities",
        colorHex: "#2563EB",
        iconName: "building-2",
        isActive: false
      },
      zod4(RoleInputSchema)
    );

    const screen = await render(RoleForm, { held: HELD, divisions: [], form });

    await expect
      .element(screen.getByRole("textbox", { name: "Name" }))
      .toHaveValue("Manager Division");
    await expect
      .element(screen.getByRole("textbox", { name: "Description (optional)" }))
      .toHaveValue("Oversees division activities");
    await expect.element(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
    await expect.element(screen.getByRole("switch", { name: "Active" })).not.toBeChecked();
  });

  it("previews the role from what is typed, unless a layer's header shows it", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });
    const screen = await render(RoleForm, { held: HELD, divisions: [], form });

    await expect.element(screen.getByText("Role name")).toBeVisible();
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Dispatcher");
    await expect.element(screen.getByText("Preview")).toBeVisible();
    expect(document.querySelector("[data-slot=record-tile]")).not.toBeNull();

    const drafts: { name: string; dirty: boolean }[] = [];
    document.body.innerHTML = "";
    const layered = await render(RoleForm, {
      held: HELD,
      divisions: [],
      form,
      ondraft: (draft) => drafts.push(draft)
    });
    expect(layered.getByText("Preview").elements()).toHaveLength(0);
    await userEvent.type(layered.getByRole("textbox", { name: "Name" }), "Auditor");
    await expect.poll(() => drafts.at(-1)).toMatchObject({ name: "Auditor", dirty: true });
  });
});

describe("RoleForm on an edit", () => {
  const STAMP = "2026-01-05T01:10:00.123Z";
  const reloadHref = "/master/things/1/edit";
  const loaded = {
    name: "Staff",
    description: "",
    colorHex: "#805AD5",
    iconName: "user" as const,
    isActive: true
  };

  it("posts the updatedAt it loaded in a hidden field, with no conflict line", async () => {
    const form = await superValidate({ ...loaded, updatedAt: STAMP }, zod4(RoleUpdateInputSchema));

    const screen = await render(RoleForm, { held: HELD, divisions: [], form, reloadHref });

    const stamp = document.querySelector<HTMLInputElement>('input[name="updatedAt"]');
    expect(stamp?.type).toBe("hidden");
    expect(stamp?.value).toBe(STAMP);
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  });

  it("posts an empty field for a record that was never stamped", async () => {
    const form = await superValidate({ ...loaded, updatedAt: null }, zod4(RoleUpdateInputSchema));

    await render(RoleForm, { held: HELD, divisions: [], form, reloadHref });

    expect(document.querySelector<HTMLInputElement>('input[name="updatedAt"]')?.value).toBe("");
  });

  it("has no updatedAt field on a create", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });

    await render(RoleForm, { held: HELD, divisions: [], form });

    expect(document.querySelector('input[name="updatedAt"]')).toBeNull();
  });

  it("keeps the input and says the record changed, with a reload link, on a stale save", async () => {
    const form = await superValidate(
      { ...loaded, name: "My edit", updatedAt: STAMP },
      zod4(RoleUpdateInputSchema)
    );
    setError(form, "updatedAt", "This record was changed by someone else since you opened it.");

    const screen = await render(RoleForm, { held: HELD, divisions: [], form, reloadHref });

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

describe("RoleForm's checks", () => {
  const loaded = {
    name: "Staff",
    description: "",
    colorHex: "#805AD5",
    iconName: "user" as const,
    isActive: true
  };

  it("says an empty name is required, under the field", async () => {
    const form = await superValidate(loaded, zod4(RoleInputSchema));
    const screen = await render(RoleForm, { held: HELD, divisions: [], form });

    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.tab();

    await expect.element(screen.getByText("Name is required.")).toBeVisible();
  });

  it("shows the API's refusal of a name that is taken, on the name", async () => {
    const refused = await superValidate(loaded, zod4(RoleInputSchema));
    setError(refused, "name", "A role with that name already exists.");

    const screen = await render(RoleForm, { held: HELD, divisions: [], form: refused });

    await expect.element(screen.getByText("A role with that name already exists.")).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Name" }))
      .toHaveAttribute("aria-invalid", "true");
  });

  it("asks before its layer closes over unsaved edits, and not when there are none", async () => {
    const { default: Fixture } = await import("./role-discard-fixture.svelte");
    const form = await superValidate(loaded, zod4(RoleInputSchema));
    const answers: boolean[] = [];
    const screen = await render(Fixture, { form, onanswer: (close) => answers.push(close) });
    const close = screen.getByRole("button", { name: "Close layer" });

    await userEvent.click(close);
    await expect.poll(() => answers).toEqual([true]);

    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(name, " Lead");

    await userEvent.click(close);
    const ask = screen.getByRole("alertdialog", { name: "Discard this new role?" });
    await expect.element(ask).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await expect.poll(() => answers).toEqual([true, false]);
    await expect.element(name).toHaveValue("Staff Lead");

    await userEvent.click(close);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await expect.poll(() => answers).toEqual([true, false, true]);
  });
});

describe("RoleForm in the layer", () => {
  it("hands a save to onsaved instead of following the action's redirect", async () => {
    const form = await superValidate(
      {
        name: "Staff",
        description: "",
        colorHex: "#805AD5",
        iconName: "user",
        isActive: true
      },
      zod4(RoleInputSchema)
    );
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ type: "redirect", status: 303, location: "/master/roles/r-1" }),
          { headers: { "content-type": "application/json" } }
        )
      );
    const saved: unknown[] = [];
    const screen = await render(RoleForm, {
      held: HELD,
      divisions: [],
      form,
      action: "/master/roles/r-1/edit",
      onsaved: (role) => saved.push(role)
    });

    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), " Lead");
    await userEvent.click(screen.getByRole("button", { name: "Save role" }));

    await expect.poll(() => saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: "Staff Lead" });
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/master/roles/r-1/edit");
    fetch.mockRestore();
  });
});

describe("RoleForm's permissions", () => {
  const loaded = {
    name: "Staff",
    description: "",
    colorHex: "#805AD5",
    iconName: "user" as const,
    isActive: true
  };
  // the keys a manager holds, and may grant or revoke
  const MANAGER = [
    "master-divisions.view_any",
    "master-divisions.view",
    "master-users.view_any",
    "master-users.view"
  ];

  const posted = () =>
    [...document.querySelectorAll<HTMLInputElement>('input[name="permissionKeys"]')]
      .filter((input) => input.type === "hidden" || input.checked)
      .filter((input) => !input.disabled)
      .map((input) => input.value)
      .sort();

  it("lists every key grouped by resource, with its label and description, ticked as loaded", async () => {
    const form = await superValidate(
      { ...loaded, permissionKeys: ["master-users.view_any"] },
      zod4(RoleFormSchema)
    );
    const screen = await render(RoleForm, { held: HELD, divisions: [], form });

    const users = screen.getByRole("group", { name: "Users" });
    await expect.element(users).toBeVisible();
    await expect
      .element(screen.getByText("The people who sign in, their roles and their status."))
      .toBeVisible();
    await expect
      .element(users.getByRole("checkbox", { name: "List" }))
      .toHaveAccessibleDescription("Open the users list and search it.");
    await expect.element(users.getByRole("checkbox", { name: "List" })).toBeChecked();
    await expect.element(users.getByRole("checkbox", { name: "View" })).not.toBeChecked();
    expect(posted()).toEqual(["master-users.view_any"]);
  });

  it("ticks and clears a whole resource with its All box", async () => {
    const form = await superValidate({ ...loaded, permissionKeys: [] }, zod4(RoleFormSchema));
    const screen = await render(RoleForm, { held: HELD, divisions: [], form });
    const all = screen.getByRole("checkbox", { name: "All Roles permissions" });

    await userEvent.click(
      screen
        .getByRole("group", { name: "Roles" })
        .getByRole("checkbox", { name: "View", exact: true })
    );
    await expect.element(all).toHaveAttribute("aria-checked", "mixed");

    await userEvent.click(all);
    await expect.element(all).toBeChecked();
    expect(posted()).toEqual(
      allPermissionKeys()
        .filter((key) => key.startsWith("master-roles."))
        .sort()
    );

    await userEvent.click(all);
    expect(posted()).toEqual([]);
  });

  it("narrows the groups with the search, and still posts what it hides", async () => {
    const form = await superValidate(
      { ...loaded, permissionKeys: ["master-divisions.manager"] },
      zod4(RoleFormSchema)
    );
    const screen = await render(RoleForm, { held: HELD, divisions: [], form });
    const search = screen.getByRole("searchbox", { name: "Search permissions" });

    await userEvent.type(search, "trash");
    await expect.element(screen.getByRole("group", { name: "Roles" })).not.toBeInTheDocument();
    await expect
      .element(
        screen
          .getByRole("group", { name: "Users" })
          .getByRole("checkbox", { name: "Restore", exact: true })
      )
      .toBeVisible();
    // Enter searches; it does not save the form
    await userEvent.keyboard("{Enter}");
    expect(posted()).toEqual(["master-divisions.manager"]);

    await userEvent.fill(search, "nothing like this");
    await expect
      .element(screen.getByText("No permissions match “nothing like this”."))
      .toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await expect.element(screen.getByRole("group", { name: "Roles" })).toBeVisible();
  });

  it("greys out a key the caller does not hold, with a hint, and All leaves it alone", async () => {
    const form = await superValidate(
      { ...loaded, permissionKeys: ["master-users.view_any"] },
      zod4(RoleFormSchema)
    );
    const screen = await render(RoleForm, { held: MANAGER, divisions: [], form });
    const users = screen.getByRole("group", { name: "Users" });

    await expect
      .element(
        screen.getByText(/You can grant or take away only the permissions you hold yourself/)
      )
      .toBeVisible();
    const remove = users.getByRole("checkbox", { name: "Delete", exact: true });
    await expect.element(remove).toBeDisabled();
    await expect.element(remove).toHaveAccessibleDescription(/You don't hold this one\./);

    await userEvent.click(screen.getByRole("checkbox", { name: "All Users permissions" }));
    expect(posted()).toEqual(["master-users.view", "master-users.view_any"]);
    // a resource with nothing the caller holds has no All to use
    await expect
      .element(screen.getByRole("checkbox", { name: "All Roles permissions" }))
      .toBeDisabled();
  });

  it("is unchanged again once a box is ticked and cleared, so closing asks nothing", async () => {
    // loaded as the API serves a role's keys: in catalogue order
    const form = await superValidate(
      { ...loaded, permissionKeys: ["master-divisions.view_any", "master-divisions.create"] },
      zod4(RoleFormSchema)
    );
    const drafts: { dirty: boolean }[] = [];
    const screen = await render(RoleForm, {
      held: HELD,
      divisions: [],
      form,
      ondraft: (draft) => drafts.push(draft)
    });
    const view = screen
      .getByRole("group", { name: "Divisions" })
      .getByRole("checkbox", { name: "View", exact: true });

    await userEvent.click(view);
    await expect.poll(() => drafts.at(-1)?.dirty).toBe(true);
    await userEvent.click(view);
    await expect.poll(() => drafts.at(-1)?.dirty).toBe(false);
  });

  it("posts the empty set when every box is cleared, so the save revokes them all", async () => {
    const form = await superValidate(
      { ...loaded, permissionKeys: ["master-users.view_any"] },
      zod4(RoleFormSchema)
    );
    const screen = await render(RoleForm, { held: HELD, divisions: [], form });

    await userEvent.click(
      screen.getByRole("group", { name: "Users" }).getByRole("checkbox", { name: "List" })
    );

    expect(posted()).toEqual([]);
    const parsed = await superValidate(new FormData(), zod4(RoleFormSchema));
    expect(parsed.data.permissionKeys).toEqual([]);
  });
});

describe("RoleForm's Division (#463)", () => {
  const HUB = "d1000000-0000-4000-8000-000000000001";
  const YARD = "d1000000-0000-4000-8000-000000000002";
  const DIVISIONS = [
    { id: HUB, name: "Hub", inactive: false },
    { id: YARD, name: "Yard", inactive: false }
  ];
  const loaded = {
    name: "Staff",
    description: "",
    colorHex: "#805AD5",
    iconName: "user" as const,
    isActive: true,
    permissionKeys: [],
    updatedAt: "2026-01-05T01:10:00.123Z"
  };
  const posted = () => document.querySelector<HTMLInputElement>('input[name="divisionId"]')?.value;
  const editing = async (divisionId: string | null) =>
    superValidate({ ...loaded, divisionId }, zod4(RoleFormUpdateSchema));

  it("has Every division as the empty choice, chosen on a new role, and posts it empty", async () => {
    const form = await superValidate(zod4(RoleFormSchema), { errors: false });

    const screen = await render(RoleForm, { held: HELD, divisions: DIVISIONS, form });

    await expect
      .element(screen.getByRole("combobox", { name: "Division" }))
      .toHaveValue("Every division");
    expect(posted()).toBe("");
  });

  it("lists the Divisions, narrows them as typed, and posts the one chosen", async () => {
    const form = await superValidate(zod4(RoleFormSchema), { errors: false });
    const screen = await render(RoleForm, { held: HELD, divisions: DIVISIONS, form });

    const field = screen.getByRole("combobox", { name: "Division" });
    await userEvent.click(field);
    await expect.element(screen.getByRole("option", { name: "Every division" })).toBeVisible();
    await expect.element(screen.getByRole("option", { name: "Hub" })).toBeVisible();

    await userEvent.fill(field, "yar");
    await expect.element(screen.getByRole("option", { name: "Yard" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Hub" }).elements()).toHaveLength(0);

    await userEvent.click(screen.getByRole("option", { name: "Yard" }));
    expect(posted()).toBe(YARD);
    await expect.element(field).toHaveValue("Yard");

    // and back to the empty choice
    await userEvent.click(field);
    await userEvent.click(screen.getByRole("option", { name: "Every division" }));
    expect(posted()).toBe("");
  });

  it("loads an edit in its Division, and keeps an Inactive one marked, out of the others' choices", async () => {
    const choices = [{ id: HUB, name: "Hub", inactive: true }, DIVISIONS[1]!];
    const screen = await render(RoleForm, {
      held: HELD,
      divisions: choices,
      form: await editing(HUB),
      reloadHref: "/master/roles/1/edit",
      holders: 0
    });

    await expect
      .element(screen.getByRole("combobox", { name: "Division" }))
      .toHaveValue("Hub (inactive)");
    expect(posted()).toBe(HUB);
  });

  it("says how many users hold the role, and that their division changes with it, once the Division changes", async () => {
    const screen = await render(RoleForm, {
      held: HELD,
      divisions: DIVISIONS,
      form: await editing(HUB),
      reloadHref: "/master/roles/1/edit",
      holders: 3
    });
    const note = screen.getByText(/division changes with it/);

    // as loaded, there is nothing to warn of
    expect(note.elements()).toHaveLength(0);

    await userEvent.click(screen.getByRole("combobox", { name: "Division" }));
    await userEvent.click(screen.getByRole("option", { name: "Yard" }));
    await expect
      .element(note)
      .toHaveTextContent("3 users hold this role. Their division changes with it.");

    // choosing the one it came from takes the warning back
    await userEvent.click(screen.getByRole("combobox", { name: "Division" }));
    await userEvent.click(screen.getByRole("option", { name: "Hub" }));
    expect(note.elements()).toHaveLength(0);
  });

  it("names one holder in the singular, and says nothing for a role nobody holds", async () => {
    const one = await render(RoleForm, {
      held: HELD,
      divisions: DIVISIONS,
      form: await editing(HUB),
      reloadHref: "/master/roles/1/edit",
      holders: 1
    });
    await userEvent.click(one.getByRole("combobox", { name: "Division" }));
    await userEvent.click(one.getByRole("option", { name: "Every division" }));
    await expect
      .element(one.getByText("1 user holds this role. Their division changes with it."))
      .toBeVisible();

    document.body.innerHTML = "";
    const none = await render(RoleForm, {
      held: HELD,
      divisions: DIVISIONS,
      form: await editing(HUB),
      reloadHref: "/master/roles/1/edit",
      holders: 0
    });
    await userEvent.click(none.getByRole("combobox", { name: "Division" }));
    await userEvent.click(none.getByRole("option", { name: "Yard" }));
    expect(none.getByText(/division changes with it/).elements()).toHaveLength(0);
  });

  it("passes axe with its list open, long enough to scroll, and closed", async () => {
    const many = Array.from({ length: 14 }, (_, index) => ({
      id: `d1000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
      name: `Division ${index + 1}`,
      inactive: false
    }));
    const form = await superValidate(zod4(RoleFormSchema), { errors: false });
    const screen = await render(RoleForm, { held: HELD, divisions: many, form });

    expect(await axeViolations(document.body)).toEqual([]);

    await userEvent.click(screen.getByRole("combobox", { name: "Division" }));
    await expect.element(screen.getByRole("option", { name: "Division 14" })).toBeVisible();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("opens its list under the whole field, the same width and left edge", async () => {
    const form = await superValidate(zod4(RoleFormSchema), { errors: false });
    const screen = await render(RoleForm, { held: HELD, divisions: DIVISIONS, form });

    await userEvent.click(screen.getByRole("combobox", { name: "Division" }));
    const list = await vi.waitUntil(() => document.querySelector("[data-slot=division-options]"));
    const field = screen.getByRole("combobox", { name: "Division" }).element().parentElement!;

    await expect
      .poll(() =>
        Math.round(list.getBoundingClientRect().left - field.getBoundingClientRect().left)
      )
      .toBe(0);
    expect(Math.round(list.getBoundingClientRect().width)).toBe(
      Math.round(field.getBoundingClientRect().width)
    );
  });
});
