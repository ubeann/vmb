import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: Notice } = await import("./Notice.svelte");

const message = createRawSnippet(() => ({ render: () => "<span>Something happened</span>" }));

describe("Notice", () => {
  it("announces an error as an alert", async () => {
    const screen = await render(Notice, { variant: "destructive", children: message });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Something happened");
    expect(screen.getByRole("status").elements()).toHaveLength(0);
  });

  it.each(["success", "default"] as const)("announces a %s notice as a status", async (variant) => {
    const screen = await render(Notice, { variant, children: message });

    await expect.element(screen.getByRole("status")).toHaveTextContent("Something happened");
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
  });

  it.each(["destructive", "success", "default"] as const)(
    "draws a decorative icon for the %s variant",
    async (variant) => {
      const screen = await render(Notice, { variant, children: message });
      const icon = screen.container.querySelector("svg");

      expect(icon).not.toBeNull();
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
    }
  );
});
