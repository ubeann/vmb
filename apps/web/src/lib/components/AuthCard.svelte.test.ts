import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

// Isolated renders don't load the global stylesheet; the outline is a style.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: AuthCard } = await import("./AuthCard.svelte");

const body = createRawSnippet(() => ({ render: () => "<p>Body</p>" }));

const text = (content: string) =>
  createRawSnippet(() => ({ render: () => `<span>${content}</span>` }));

describe("AuthCard", () => {
  it("puts the description under the heading and the footer after the body", async () => {
    const screen = await render(AuthCard, {
      heading: "Log in",
      description: text("Use your VMB email."),
      children: body,
      footer: text("First time here?")
    });
    const order = (first: string, second: string) =>
      screen
        .getByText(first)
        .element()
        .compareDocumentPosition(screen.getByText(second).element()) &
      Node.DOCUMENT_POSITION_FOLLOWING;

    expect(order("Log in", "Use your VMB email.")).toBeTruthy();
    expect(order("Use your VMB email.", "Body")).toBeTruthy();
    expect(order("Body", "First time here?")).toBeTruthy();
  });

  it("can take focus without drawing a ring", async () => {
    const screen = await render(AuthCard, { heading: "Log in", children: body });
    const heading = screen.getByRole("heading", { name: "Log in" });

    heading.element().focus();

    await expect.element(heading).toHaveFocus();
    expect(getComputedStyle(heading.element()).outlineStyle).toBe("none");
  });
});
