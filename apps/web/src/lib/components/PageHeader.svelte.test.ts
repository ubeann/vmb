import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";

import { axeViolations } from "$lib/a11y-support.js";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: PageHeader } = await import("./PageHeader.svelte");

describe("PageHeader", () => {
  it("holds the title as the page's h1, its description and its one action", async () => {
    const screen = await render(PageHeader, {
      title: "Divisions",
      description: "A User belongs to one or more Divisions.",
      action: createRawSnippet(() => ({ render: () => `<a href="/new">New division</a>` }))
    });

    await expect
      .element(screen.getByRole("heading", { name: "Divisions", level: 1 }))
      .toBeVisible();
    await expect
      .element(screen.getByText("A User belongs to one or more Divisions."))
      .toBeVisible();
    await expect.element(screen.getByRole("link", { name: "New division" })).toBeVisible();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("needs neither a description nor an action", async () => {
    const screen = await render(PageHeader, { title: "New division" });

    await expect.element(screen.getByRole("heading", { name: "New division" })).toBeVisible();
    expect(screen.container.querySelector("p")).toBeNull();
    expect(screen.container.querySelector("a")).toBeNull();
  });
});
