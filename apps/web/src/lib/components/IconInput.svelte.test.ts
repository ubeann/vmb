import Mail from "@lucide/svelte/icons/mail";
import { describe, expect, it } from "vitest";

// Layout is measured, so the stylesheet has to be loaded (see login/touch-target.svelte.test.ts).
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: IconInput } = await import("./IconInput.svelte");

describe("IconInput", () => {
  it("draws the icon as decoration, inside the field's own wrapper", async () => {
    const screen = await render(IconInput, { icon: Mail, id: "email", type: "email" });
    const icon = screen.container.querySelector("svg");

    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.parentElement).toBe(screen.getByRole("textbox").element().parentElement);
  });

  it("keeps the field's own name and attributes", async () => {
    const screen = await render(IconInput, {
      icon: Mail,
      id: "email",
      name: "email",
      placeholder: "name@company.com"
    });

    await expect
      .element(screen.getByRole("textbox"))
      .toHaveAttribute("placeholder", "name@company.com");
    await expect.element(screen.getByRole("textbox")).toHaveAttribute("name", "email");
  });

  it("keeps the invalid marking on the field, and the icon inside its box", async () => {
    const screen = await render(IconInput, { icon: Mail, id: "email", "aria-invalid": "true" });
    const input = screen.getByRole("textbox").element();
    const box = input.getBoundingClientRect();
    const icon = screen.container.querySelector("svg")!.getBoundingClientRect();

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(icon.left).toBeGreaterThanOrEqual(box.left);
    expect(icon.right).toBeLessThanOrEqual(box.right);
  });

  it("pads the text clear of the icon and keeps the icon out of pointer events", async () => {
    const screen = await render(IconInput, { icon: Mail, id: "email" });
    const input = screen.getByRole("textbox").element();
    const icon = screen.container.querySelector("svg")!;

    const iconRight = icon.getBoundingClientRect().right;
    const textLeft =
      input.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(input).paddingLeft);
    expect(textLeft - iconRight).toBeGreaterThanOrEqual(8);
    expect(getComputedStyle(icon).pointerEvents).toBe("none");
  });
});
