import { DivisionInputSchema, DivisionUpdateInputSchema, type IconName } from "@vmb/types";
import { setError, superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { darkerShade } from "$lib/components/form/color.js";

// A refused submit ends in SvelteKit's applyAction, which needs the running
// app an isolated render doesn't start
vi.mock("$app/forms", async (original) => ({
  ...(await original<typeof import("$app/forms")>()),
  applyAction: vi.fn()
}));

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
    await expect
      .element(screen.getByRole("textbox", { name: "Description (optional)" }))
      .toHaveAttribute("placeholder", "Such as budgets, invoices and payment settlement");
    await expect.element(screen.getByRole("group", { name: "Color" })).toBeVisible();
    // the hex field waits in the custom panel, closed until asked for
    await expect
      .element(screen.getByRole("button", { name: "Custom color" }))
      .toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("textbox", { name: "Hex" }).elements()).toHaveLength(0);
    // a line of icons, the schema's default first and named by the heading, and the catalogue a click away
    const icons = screen.getByRole("group", { name: "Icon", exact: true });
    await expect.element(icons).toBeVisible();
    await expect.element(screen.getByRole("radio", { name: "Rocket" })).toBeChecked();
    expect(icons.getByRole("radio").elements()[0]!.getAttribute("aria-label")).toBe("Rocket");
    expect(icons.getByRole("radio").elements().length).toBeGreaterThanOrEqual(4);
    await expect.element(icons.getByText("· Rocket")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "More icons" })).toBeVisible();
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
        iconName: "settings",
        isActive: false
      },
      zod4(DivisionInputSchema)
    );

    const screen = await render(DivisionForm, { form, submitLabel: "Update division" });

    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Operations");
    await expect.element(screen.getByRole("textbox", { name: "Code" })).toHaveValue("OPS");
    await expect
      .element(screen.getByRole("textbox", { name: "Description (optional)" }))
      .toHaveValue("Fleet and day-to-day operations");
    await expect.element(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
    await expect.element(screen.getByRole("radio", { name: "Settings" })).toBeChecked();
    await expect.element(screen.getByRole("switch", { name: "Active" })).not.toBeChecked();
    await expect.element(screen.getByRole("button", { name: "Update division" })).toBeVisible();
  });

  it("fills the code from a new name until the code is typed, and keeps an existing one", async () => {
    const form = await superValidate(zod4(DivisionInputSchema), { errors: false });
    const screen = await render(DivisionForm, { form });
    const name = screen.getByRole("textbox", { name: "Name" });
    const code = screen.getByRole("textbox", { name: "Code" });

    // a sparkle in the field while the code follows the name, said to a screen reader in the hint
    const follows = () => document.querySelector("[data-code-follows-name]");
    expect(follows()).not.toBeNull();
    await expect
      .element(code)
      .toHaveAccessibleDescription(
        /3 to 5 characters\. Filled from the name until you type your own/
      );
    await userEvent.type(name, "Quality Assurance");
    await expect.element(code).toHaveValue("QAS");

    // typed in, the code is the person's: uppercased, and no longer following the name
    await userEvent.clear(code);
    await userEvent.type(code, "qa");
    await expect.element(code).toHaveValue("QA");
    await userEvent.type(name, " Team");
    await expect.element(code).toHaveValue("QA");
    // and once it is the person's own, the sparkle goes and the hint is the rule alone
    expect(follows()).toBeNull();
    await expect.element(code).toHaveAccessibleDescription("3 to 5 characters");
  });

  it("does not rewrite a saved code when the name changes", async () => {
    const form = await superValidate(
      { name: "Finance", code: "FIN", colorHex: "#16A34A", iconName: "banknote" },
      zod4(DivisionInputSchema)
    );
    const screen = await render(DivisionForm, { form });

    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), " and Tax");
    await expect.element(screen.getByRole("textbox", { name: "Code" })).toHaveValue("FIN");
  });

  it("sets the hex from a swatch, and a typed hex picks its swatch", async () => {
    const form = await superValidate(
      { name: "Finance", code: "FIN", colorHex: "#16A34A", iconName: "banknote" },
      zod4(DivisionInputSchema)
    );
    const screen = await render(DivisionForm, { form });
    const hex = screen.getByRole("textbox", { name: "Hex" });
    const color = screen.getByRole("group", { name: "Color" });

    await expect.element(screen.getByRole("radio", { name: "Green" })).toBeChecked();
    // the heading names it, and with the panel closed the form still posts it
    await expect.element(color.getByText("· Green")).toBeVisible();
    expect(new FormData(document.querySelector("form")!).get("colorHex")).toBe("#16A34A");
    await userEvent.click(screen.getByRole("button", { name: "Custom color" }));
    await userEvent.click(screen.getByRole("radio", { name: "Red" }));
    await expect.element(hex).toHaveValue("#DC2626");

    await userEvent.clear(hex);
    await userEvent.type(hex, "#0d9488");
    await expect.element(screen.getByRole("radio", { name: "Teal" })).toBeChecked();
    // as a design tool copies it: no #, lower case
    await userEvent.clear(hex);
    await userEvent.type(hex, "dc2626");
    await expect.element(hex).toHaveValue("#DC2626");
    await expect.element(screen.getByRole("radio", { name: "Red" })).toBeChecked();
    // a colour no swatch has leaves them all unchecked
    await userEvent.clear(hex);
    await userEvent.type(hex, "#123456");
    await expect.element(color.getByText("· #123456")).toBeVisible();
    expect(
      screen
        .getByRole("group", { name: "Color" })
        .getByRole("radio")
        .elements()
        .some((radio) => (radio as HTMLInputElement).checked)
    ).toBe(false);
  });

  it("opens a custom picker under the swatches that sets the hex, by keys as well", async () => {
    const form = await superValidate(
      { name: "Finance", code: "FIN", colorHex: "#16A34A", iconName: "banknote" },
      zod4(DivisionInputSchema)
    );
    const screen = await render(DivisionForm, { form });
    const hex = screen.getByRole("textbox", { name: "Hex" });
    const custom = screen.getByRole("button", { name: "Custom color" });

    await expect.element(custom).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(custom);
    await expect.element(custom).toHaveAttribute("aria-expanded", "true");

    // it starts on the colour the form holds
    const plane = screen.getByRole("slider", { name: "Saturation and brightness" });
    await expect.element(plane).toHaveAttribute("aria-valuetext", "Saturation 87%, brightness 64%");

    // an isolated render has no stylesheet to give the square its size, so focus goes to the thumb directly
    (plane.element() as HTMLElement).focus();
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    await expect.element(plane).toHaveAttribute("aria-valuetext", "Saturation 77%, brightness 64%");
    await expect.element(hex).not.toHaveValue("#16A34A");

    // a hex typed in moves the picker to it
    await userEvent.clear(hex);
    await userEvent.type(hex, "#ff0000");
    await expect
      .element(plane)
      .toHaveAttribute("aria-valuetext", "Saturation 100%, brightness 100%");
    await expect.element(screen.getByRole("slider", { name: "Hue" })).toHaveValue("0");

    await userEvent.click(custom);
    await expect.element(custom).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("slider", { name: "Hue" }).elements()).toHaveLength(0);
  });

  it("says when a colour is too pale to see on a light tile, and still lets it be saved", async () => {
    const form = await superValidate(
      { name: "Finance", code: "FIN", colorHex: "#CA8A04", iconName: "banknote" },
      zod4(DivisionInputSchema)
    );
    const screen = await render(DivisionForm, { form });
    const hex = screen.getByRole("textbox", { name: "Hex" });
    const note = /Hard to see in light mode/;
    await userEvent.click(screen.getByRole("button", { name: "Custom color" }));

    // the palest swatch is fine
    expect(screen.getByText(note).elements()).toHaveLength(0);
    await userEvent.clear(hex);
    await userEvent.type(hex, "#FDE68A");
    await expect.element(screen.getByText(note)).toBeVisible();
    await expect.element(hex).not.toHaveAttribute("aria-invalid", "true");

    // one click darkens it to a shade that reads, and the note goes
    await userEvent.click(screen.getByRole("button", { name: "Use a darker shade" }));
    await expect.element(hex).toHaveValue(darkerShade("#FDE68A"));
    await expect.poll(() => screen.getByText(note).elements()).toHaveLength(0);
  });

  it("keeps a stored icon outside the catalogue as its own choice, and asks for another", async () => {
    // a legacy name migration 0032 had no icon for (#176), loaded as the edit page loads it
    const form = await superValidate(
      {
        name: "Legacy",
        code: "LEG",
        colorHex: "#16A34A",
        iconName: "heroicon-o-arrow-left" as IconName
      },
      zod4(DivisionInputSchema)
    );
    const screen = await render(DivisionForm, { form });

    const kept = screen.getByRole("radio", { name: "Current icon (heroicon-o-arrow-left)" });
    await expect.element(kept).toBeChecked();
    await expect.element(screen.getByText("Pick an icon from the list.")).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Truck" }));
    await expect.element(screen.getByRole("radio", { name: "Truck" })).toBeChecked();
    // a pick stores the Lucide name (#176)
    expect(new FormData(document.querySelector("form")!).get("iconName")).toBe("truck");
  });

  it("posts a swatch or an icon picked without JavaScript, as the server reads the form", async () => {
    const form = await superValidate(
      { name: "Finance", code: "FIN", colorHex: "#123456", iconName: "banknote" },
      zod4(DivisionInputSchema)
    );
    const screen = await render(DivisionForm, { form });
    // Superforms reads a field that posts twice by its last value
    const posted = (field: string) =>
      new FormData(document.querySelector("form")!).getAll(field).at(-1);

    // as loaded: a custom colour no swatch shows, and the stored icon, unchanged
    expect(posted("colorHex")).toBe("#123456");
    expect(posted("iconName")).toBe("banknote");

    // checked as a browser checks a radio with no script to hear it
    const check = (name: string) => {
      (screen.getByRole("radio", { name }).element() as HTMLInputElement).checked = true;
    };
    check("Teal");
    const other = screen
      .getByRole("group", { name: "Icon", exact: true })
      .getByRole("radio")
      .elements()[1] as HTMLInputElement;
    other.checked = true;
    expect(posted("colorHex")).toBe("#0D9488");
    expect(posted("iconName")).toBe(other.value);
  });

  it("suggests icons from the name as it is typed", async () => {
    const form = await superValidate(zod4(DivisionInputSchema), { errors: false });
    const screen = await render(DivisionForm, { form });

    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Finance");

    // the icon chosen stays first, and chosen; the money icons follow it
    await expect
      .poll(() =>
        screen
          .getByRole("group", { name: "Icon", exact: true })
          .getByRole("radio")
          .elements()
          .slice(0, 4)
          .map((radio) => radio.getAttribute("aria-label"))
      )
      .toEqual(["Rocket", "Banknotes", "Wallet", "Coins"]);
    await expect.element(screen.getByRole("radio", { name: "Rocket" })).toBeChecked();
  });

  it("opens the catalogue in the form, by group or by a search that knows synonyms", async () => {
    const form = await superValidate(
      { name: "Finance", code: "FIN", colorHex: "#16A34A", iconName: "banknote" },
      zod4(DivisionInputSchema)
    );
    const screen = await render(DivisionForm, { form });
    const search = screen.getByRole("searchbox", { name: "Search icons" });

    await userEvent.click(screen.getByRole("button", { name: "More icons" }));
    await expect.element(search).toHaveFocus();
    // the stored icon shows chosen
    await expect.element(screen.getByRole("radio", { name: "Banknotes" })).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Logistics" }));
    await expect
      .element(screen.getByRole("button", { name: "Logistics" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect.element(screen.getByRole("radio", { name: "Forklift" })).toBeVisible();

    await userEvent.type(search, "money");
    await expect.element(screen.getByRole("radio", { name: "Coins" })).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Wallet" }));
    expect(new FormData(document.querySelector("form")!).get("iconName")).toBe("wallet");

    await userEvent.clear(search);
    await userEvent.type(search, "zzz");
    await expect.element(screen.getByText(/No icons match “zzz”/)).toBeVisible();
    // the clear button empties the search and keeps the cursor in it
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await expect.element(search).toHaveValue("");
    await expect.element(search).toHaveFocus();
    await userEvent.type(search, "zzz");

    // Esc clears the search, then closes the catalogue and hands focus back
    await userEvent.keyboard("{Escape}");
    await expect.element(search).toHaveValue("");
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("button", { name: "More icons" })).toHaveFocus();
    await expect.element(screen.getByRole("radio", { name: "Wallet" })).toBeChecked();
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
    iconName: "settings" as const,
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
    iconName: "settings" as const,
    isActive: true
  };

  it("accepts only a #RRGGBB color, with the schema's message under the field", async () => {
    const form = await superValidate(loaded, zod4(DivisionInputSchema));
    const screen = await render(DivisionForm, { form });

    await userEvent.click(screen.getByRole("button", { name: "Custom color" }));
    const color = screen.getByRole("textbox", { name: "Hex" });
    await userEvent.clear(color);
    await userEvent.type(color, "#25E");
    await userEvent.click(screen.getByRole("button", { name: "Save division" }));

    await expect
      .element(screen.getByText("Color must be a hex value such as #2563EB."))
      .toBeVisible();
    await expect.element(color).toHaveAttribute("aria-invalid", "true");
  });

  it("says an empty code is required, once, in place of its hint", async () => {
    const form = await superValidate(loaded, zod4(DivisionInputSchema));
    const screen = await render(DivisionForm, { form });

    await userEvent.clear(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Code" }));
    await userEvent.tab();

    await expect.element(screen.getByText("Name is required.")).toBeVisible();
    await expect.element(screen.getByText("Code is required.")).toBeVisible();
    expect(screen.getByText("3 to 5 characters").elements()).toHaveLength(0);
    expect(screen.getByText(/Code must be/).elements()).toHaveLength(0);
  });

  it("turns the code's hint red for a wrong length, and shows any other error as it is", async () => {
    const form = await superValidate(loaded, zod4(DivisionInputSchema));
    const screen = await render(DivisionForm, { form });

    const code = screen.getByRole("textbox", { name: "Code" });
    await userEvent.clear(code);
    await userEvent.type(code, "op");
    await userEvent.click(screen.getByRole("button", { name: "Save division" }));

    const hint = screen.getByText("3 to 5 characters");
    await expect.element(hint).toBeVisible();
    expect(hint.elements()).toHaveLength(1);
    expect(hint.element().closest("[data-slot=form-field-error]")).not.toBeNull();
    await expect.element(code).toHaveAttribute("aria-invalid", "true");

    const refused = await superValidate(loaded, zod4(DivisionInputSchema));
    setError(refused, "code", "Code is already in use.");
    const again = await render(DivisionForm, { form: refused });
    await expect.element(again.getByText("Code is already in use.")).toBeVisible();
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
    // a form with no record behind it asks about the new one
    const ask = screen.getByRole("alertdialog", { name: "Discard this new division?" });
    await expect.element(ask).toBeVisible();
    await expect.element(ask).toHaveAccessibleDescription("What you've entered won't be saved.");
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
        iconName: "settings",
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
