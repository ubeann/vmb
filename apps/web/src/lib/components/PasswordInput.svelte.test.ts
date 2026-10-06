import { describe, expect, it, vi } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: PasswordInput } = await import("./PasswordInput.svelte");

async function renderField(props: Record<string, unknown> = {}) {
  const screen = await render(PasswordInput, { id: "password", name: "password", ...props });
  const field = () => screen.container.querySelector<HTMLInputElement>("#password")!;
  const toggle = screen.getByRole("button", { name: "Show password" });
  return { screen, field, toggle };
}

describe("PasswordInput", () => {
  it("hides what is typed until the toggle is pressed", async () => {
    const { field, toggle } = await renderField();

    expect(field().type).toBe("password");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();

    expect(field().type).toBe("text");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "true");

    await toggle.click();

    expect(field().type).toBe("password");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the toggle's name, so only its pressed state tells which way it is set", async () => {
    const { toggle } = await renderField();

    await toggle.click();

    await expect.element(toggle).toHaveAccessibleName("Show password");
    await expect.element(toggle).toHaveAttribute("aria-controls", "password");
  });

  // Swapping the element instead would drop the value and password-manager autofill.
  it("keeps the same field and what was typed in it when the type switches", async () => {
    const { field, toggle } = await renderField();
    const before = field();
    before.value = "correct horse battery staple";

    await toggle.click();

    expect(field()).toBe(before);
    expect(field().value).toBe("correct horse battery staple");
  });

  it("passes the field's own attributes through", async () => {
    const { field } = await renderField({
      autocomplete: "new-password",
      required: true,
      "aria-invalid": "true",
      class: "extra"
    });

    expect(field().name).toBe("password");
    expect(field().autocomplete).toBe("new-password");
    expect(field().required).toBe(true);
    expect(field().getAttribute("aria-invalid")).toBe("true");
    expect(field().classList.contains("extra")).toBe(true);
  });

  // On a phone, focus leaving the field closes the keyboard mid-word.
  it("leaves focus and the caret in the field when pressed while typing", async () => {
    const { field, toggle } = await renderField();
    field().focus();
    field().value = "crate yard";
    field().setSelectionRange(5, 5);

    await toggle.click();

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field());
      expect([field().selectionStart, field().selectionEnd]).toEqual([5, 5]);
    });
    expect(field().type).toBe("text");
  });

  it("keeps focus on the toggle when it is used from the keyboard", async () => {
    const { field, toggle } = await renderField();
    toggle.element().focus();

    (toggle.element() as HTMLButtonElement).click();

    await expect.element(toggle).toHaveFocus();
    expect(field().type).toBe("text");
  });
});
