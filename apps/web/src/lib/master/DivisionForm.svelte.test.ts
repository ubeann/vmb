import { DivisionInputSchema, DivisionUpdateInputSchema } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

const { render } = await import("vitest-browser-svelte");
const { default: DivisionForm } = await import("./DivisionForm.svelte");

describe("DivisionForm", () => {
  it("renders every legacy field, active by default", async () => {
    const form = await superValidate(zod4(DivisionInputSchema), { errors: false });
    form.data.isActive = true;

    const screen = await render(DivisionForm, { form });

    // a visible label per field
    await expect.element(screen.getByRole("textbox", { name: "Name" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Code" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Description" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Color" })).toBeVisible();
    await expect.element(screen.getByRole("textbox", { name: "Icon" })).toBeVisible();
    await expect.element(screen.getByRole("switch", { name: "Active" })).toBeChecked();
    // one primary action
    await expect.element(screen.getByRole("button", { name: "Save division" })).toBeVisible();
    expect(document.querySelectorAll("button[type=submit]")).toHaveLength(1);
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
    await expect.element(screen.getByRole("textbox", { name: "Code" })).toHaveValue("OPS");
    await expect
      .element(screen.getByRole("textbox", { name: "Description" }))
      .toHaveValue("Fleet and day-to-day operations");
    await expect.element(screen.getByRole("switch", { name: "Active" })).not.toBeChecked();
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

describe("DivisionForm's checks", () => {
  const loaded = {
    name: "Operations",
    code: "OPS",
    description: "",
    colorHex: "#2563EB",
    iconName: "heroicon-o-cog-6-tooth",
    isActive: true
  };

  it("accepts only a #RRGGBB color, with the schema's message under the field", async () => {
    const form = await superValidate(loaded, zod4(DivisionInputSchema));
    const screen = await render(DivisionForm, { form });

    const color = screen.getByRole("textbox", { name: "Color" });
    await userEvent.clear(color);
    await userEvent.type(color, "#25E");
    await userEvent.click(screen.getByRole("button", { name: "Save division" }));

    await expect
      .element(screen.getByText("Color must be a hex value such as #2563EB."))
      .toBeVisible();
    await expect.element(color).toHaveAttribute("aria-invalid", "true");
  });

  it("asks before its layer closes over unsaved edits, and not when there are none", async () => {
    const { default: Fixture } = await import("./discard-fixture.svelte");
    const form = await superValidate(loaded, zod4(DivisionInputSchema));
    const answers: boolean[] = [];
    const screen = await render(Fixture, { form, onanswer: (close) => answers.push(close) });
    const close = screen.getByRole("button", { name: "Close layer" });

    // nothing changed: it closes without a question
    await userEvent.click(close);
    await expect.poll(() => answers).toEqual([true]);

    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(name, " and Fleet");

    await userEvent.click(close);
    const ask = screen.getByRole("alertdialog", { name: "Discard changes?" });
    await expect.element(ask).toBeVisible();
    // the safe answer has focus
    await expect.element(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await expect.poll(() => answers).toEqual([true, false]);
    await expect.element(name).toHaveValue("Operations and Fleet");

    await userEvent.click(close);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await expect.poll(() => answers).toEqual([true, false, true]);
  });
});

describe("DivisionForm in the layer", () => {
  it("hands a save to onsaved instead of following the action's redirect", async () => {
    const form = await superValidate(
      {
        name: "Operations",
        code: "OPS",
        description: "",
        colorHex: "#2563EB",
        iconName: "heroicon-o-cog-6-tooth",
        isActive: true
      },
      zod4(DivisionInputSchema)
    );
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ type: "redirect", status: 303, location: "/master/divisions/d-1" }),
          { headers: { "content-type": "application/json" } }
        )
      );
    const saved: unknown[] = [];
    const screen = await render(DivisionForm, {
      form,
      action: "/master/divisions/d-1/edit",
      onsaved: (division) => saved.push(division)
    });

    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), " and Fleet");
    await userEvent.click(screen.getByRole("button", { name: "Save division" }));

    await expect.poll(() => saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: "Operations and Fleet" });
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/master/divisions/d-1/edit");
    fetch.mockRestore();
  });
});
