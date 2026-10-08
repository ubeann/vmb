import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: EmptyState } = await import("./EmptyState.svelte");

describe("EmptyState", () => {
  it("names what is missing, says what to do, and offers the action", async () => {
    const screen = await render(EmptyState, {
      title: "No divisions match",
      description: "Try another search, or clear the filters.",
      children: createRawSnippet(() => ({ render: () => `<a href="/master/divisions">Clear</a>` }))
    });

    await expect.element(screen.getByRole("heading", { name: "No divisions match" })).toBeVisible();
    await expect
      .element(screen.getByText("Try another search, or clear the filters."))
      .toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Clear" })).toBeVisible();
  });
});
