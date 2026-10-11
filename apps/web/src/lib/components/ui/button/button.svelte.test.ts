import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

// Isolated renders don't load the global stylesheet; the dimming is a style.
import "../../../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: Button } = await import("./button.svelte");

const children = createRawSnippet(() => ({ render: () => "<span>Previous</span>" }));
const style = (element: Element) => getComputedStyle(element);

describe("Button as a link", () => {
  it("dims a disabled one and takes no pointer events, so it never takes the hover wash", async () => {
    const screen = await render(Button, {
      href: "/master/divisions?page=1",
      disabled: true,
      variant: "outline",
      children
    });
    const link = screen.getByRole("link", { name: "Previous" });

    await expect.element(link).toHaveAttribute("aria-disabled", "true");
    await expect.element(link).not.toHaveAttribute("href");
    expect(style(link.element()).opacity).toBe("0.5");
    expect(style(link.element()).pointerEvents).toBe("none");
  });

  it("leaves an enabled one at full strength", async () => {
    const screen = await render(Button, { href: "/master/divisions?page=2", children });
    const link = screen.getByRole("link", { name: "Previous" });

    expect(style(link.element()).opacity).toBe("1");
    expect(style(link.element()).pointerEvents).not.toBe("none");
  });
});
