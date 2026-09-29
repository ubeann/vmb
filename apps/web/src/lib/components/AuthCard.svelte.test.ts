import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

// Isolated renders don't load the global stylesheet; the outline is a style.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: AuthCard } = await import("./AuthCard.svelte");

const body = createRawSnippet(() => ({ render: () => "<p>Body</p>" }));

describe("AuthCard", () => {
  it("can take focus without drawing a ring", async () => {
    const screen = await render(AuthCard, { heading: "Log in", children: body });
    const heading = screen.getByRole("heading", { name: "Log in" });

    heading.element().focus();

    await expect.element(heading).toHaveFocus();
    expect(getComputedStyle(heading.element()).outlineStyle).toBe("none");
  });
});
