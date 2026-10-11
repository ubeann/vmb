import { afterEach, describe, expect, it } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import { SINGLE_KEY_STORAGE, shortcuts } from "$lib/components/shortcuts.svelte.js";

const { render } = await import("vitest-browser-svelte");
const { default: Fixture } = await import("./shortcuts-fixture.svelte");

const sheet = () => browser.getByRole("dialog", { name: "Keyboard shortcuts" });

const switchControl = () => sheet().getByRole("switch", { name: "Single-key shortcuts" });

afterEach(() => {
  shortcuts.open = false;
  shortcuts.singleKey = true;
  localStorage.clear();
});

describe("the shortcut sheet", () => {
  it("opens on ? and lists Everywhere first", async () => {
    await render(Fixture);
    await expect.element(sheet()).not.toBeInTheDocument();

    await userEvent.keyboard("?");

    await expect.element(sheet()).toBeVisible();
    const headings = browser.getByRole("heading", { level: 3 });
    await expect.element(headings.first()).toHaveTextContent("Everywhere");
    await expect.element(sheet().getByText("Show or hide keyboard shortcuts")).toBeVisible();
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

  it("closes on ? as well as Esc", async () => {
    await render(Fixture);
    await userEvent.keyboard("?");
    await expect.element(sheet()).toBeVisible();

    await userEvent.keyboard("?");
    await expect.element(sheet()).not.toBeInTheDocument();

    await userEvent.keyboard("?");
    await expect.element(sheet()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(sheet()).not.toBeInTheDocument();
  });

  describe("the single-key switch (ADR-0052 rule 5)", () => {
    it("sits in the footer, on by default", async () => {
      await render(Fixture, { withPage: true });
      await userEvent.keyboard("?");

      await expect.element(switchControl()).toBeChecked();
      await expect.element(sheet().getByText(/Turn this off if keys like/)).toBeVisible();
      await expect.element(sheet().getByText("Off", { exact: true })).not.toBeInTheDocument();
    });

    it("turns ? off, says the single-key rows are off, and is remembered", async () => {
      await render(Fixture, { withPage: true });
      await userEvent.keyboard("?");
      await switchControl().click();

      await expect.element(switchControl()).not.toBeChecked();
      expect(localStorage.getItem(SINGLE_KEY_STORAGE)).toBe("off");
      await expect.element(sheet().getByText(/Single-key shortcuts are off\./)).toBeVisible();
      // the single-key rows stay listed, marked off: "?" and the page's X
      const rows = sheet().getByText("Off", { exact: true });
      await expect.element(rows).toHaveLength(2);
      await expect.element(sheet().getByText("Do the test thing")).toBeVisible();

      // ? is a single key now, so it neither closes nor opens the sheet
      await userEvent.keyboard("?");
      await expect.element(sheet()).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(sheet()).not.toBeInTheDocument();
      await userEvent.keyboard("?");
      await expect.element(sheet()).not.toBeInTheDocument();
    });

    it("keeps the sheet reachable without ?, and the setting across a reload", async () => {
      localStorage.setItem(SINGLE_KEY_STORAGE, "off");
      await render(Fixture);
      await userEvent.keyboard("?");
      await expect.element(sheet()).not.toBeInTheDocument();

      // the sidebar's Shortcuts row sets this
      shortcuts.open = true;
      await expect.element(sheet()).toBeVisible();
      await expect.element(switchControl()).not.toBeChecked();

      await switchControl().click();
      await expect.element(switchControl()).toBeChecked();
      expect(localStorage.getItem(SINGLE_KEY_STORAGE)).toBe("on");
      await userEvent.keyboard("?");
      await expect.element(sheet()).not.toBeInTheDocument();
    });

    it("has no axe violations with the switch off", async () => {
      localStorage.setItem(SINGLE_KEY_STORAGE, "off");
      await render(Fixture, { withPage: true });
      shortcuts.open = true;
      await expect.element(switchControl()).not.toBeChecked();
      await expect.poll(() => document.getAnimations().length).toBe(0);

      expect(await axeViolations(document.body)).toEqual([]);
    });
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
    // Axe reads the colours it sees, and blends the text of a half-faded sheet: wait out the fade-in.
    await expect.poll(() => document.getAnimations().length).toBe(0);

    expect(await axeViolations(document.body)).toEqual([]);
  });
});
