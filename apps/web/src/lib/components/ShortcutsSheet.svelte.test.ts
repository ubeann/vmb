import { afterEach, describe, expect, it } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import { shortcuts } from "$lib/components/shortcuts.svelte.js";

const { render } = await import("vitest-browser-svelte");
const { default: Fixture } = await import("./shortcuts-fixture.svelte");

const sheet = () => browser.getByRole("dialog", { name: "Keyboard shortcuts" });

afterEach(() => {
  shortcuts.open = false;
});

describe("the shortcut sheet", () => {
  it("opens on ? and lists Everywhere first", async () => {
    await render(Fixture);
    await expect.element(sheet()).not.toBeInTheDocument();

    await userEvent.keyboard("?");

    await expect.element(sheet()).toBeVisible();
    const headings = browser.getByRole("heading", { level: 3 });
    await expect.element(headings.first()).toHaveTextContent("Everywhere");
    await expect.element(sheet().getByText("Show keyboard shortcuts")).toBeVisible();
    await expect.element(sheet().getByText("Collapse or expand the sidebar")).toBeVisible();
  });

  it("opens on its title, with no ring on the close button", async () => {
    await render(Fixture);
    await userEvent.keyboard("?");

    await expect
      .element(browser.getByRole("heading", { name: "Keyboard shortcuts" }))
      .toHaveFocus();
    await expect.element(sheet().getByRole("button", { name: "Close" })).not.toHaveFocus();
  });

  it("does not open when ? is typed in a field", async () => {
    const screen = await render(Fixture);
    await userEvent.click(screen.getByRole("textbox", { name: "A field" }));
    await userEvent.keyboard("?");

    await expect.element(sheet()).not.toBeInTheDocument();
    await expect.element(screen.getByRole("textbox", { name: "A field" })).toHaveValue("?");
  });

  it("does not open over another layer", async () => {
    await render(Fixture, { layer: true });
    await userEvent.keyboard("?");

    await expect.element(sheet()).not.toBeInTheDocument();
  });

  it("closes on Esc, and ? opens it again", async () => {
    await render(Fixture);
    await userEvent.keyboard("?");
    await expect.element(sheet()).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect.element(sheet()).not.toBeInTheDocument();

    await userEvent.keyboard("?");
    await expect.element(sheet()).toBeVisible();
  });

  it("lists a page's sections only while the page is mounted", async () => {
    const screen = await render(Fixture, { withPage: true });
    await userEvent.keyboard("?");

    const headings = browser.getByRole("heading", { level: 3 });
    await expect.element(headings.nth(1)).toHaveTextContent("On the test page");
    await expect.element(sheet().getByText("Do the test thing")).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await screen.rerender({ withPage: false });
    await userEvent.keyboard("?");

    await expect.element(sheet()).toBeVisible();
    await expect.element(sheet().getByText("Do the test thing")).not.toBeInTheDocument();
    await expect.element(headings).toHaveLength(1);
  });

  it("has no axe violations", async () => {
    await render(Fixture, { withPage: true });
    await userEvent.keyboard("?");
    await expect.element(sheet()).toBeVisible();

    expect(await axeViolations(document.body)).toEqual([]);
  });
});
