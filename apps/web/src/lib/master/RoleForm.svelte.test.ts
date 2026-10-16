import { RoleInputSchema, RoleUpdateInputSchema } from "@vmb/types";
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

describe("RoleForm", () => {
  it("renders the role fields, active by default, with one primary action", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });
    form.data.isActive = true;

    const screen = await render(RoleForm, { form });

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

  it("has no Division field: a role's division is set with its permissions, not here", async () => {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });

    await render(RoleForm, { form });

    expect(document.querySelector('[name="divisionId"]')).toBeNull();
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

    const screen = await render(RoleForm, { form });

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
    const screen = await render(RoleForm, { form });

    await expect.element(screen.getByText("Role name")).toBeVisible();
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Dispatcher");
    await expect.element(screen.getByText("Preview")).toBeVisible();
    expect(document.querySelector("[data-slot=record-tile]")).not.toBeNull();

    const drafts: { name: string; dirty: boolean }[] = [];
    document.body.innerHTML = "";
    const layered = await render(RoleForm, {
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
    const screen = await render(RoleForm, { form });

    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.tab();

    await expect.element(screen.getByText("Name is required.")).toBeVisible();
  });

  it("shows the API's refusal of a name that is taken, on the name", async () => {
    const refused = await superValidate(loaded, zod4(RoleInputSchema));
    setError(refused, "name", "A role with that name already exists.");

    const screen = await render(RoleForm, { form: refused });

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
