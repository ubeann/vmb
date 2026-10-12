import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the pointer and sheet need it.
import "../../../app.css";

import { SINGLE_KEY_STORAGE, shortcuts } from "$lib/components/shortcuts.svelte.js";

const { render } = await import("vitest-browser-svelte");
const { default: Fixture } = await import("./row-keys-fixture.svelte");

const row = (name: string) => browser.getByRole("row", { name: new RegExp(name) });
const marked = () => document.querySelector("tr[data-marked]")?.textContent?.trim() ?? null;

afterEach(() => {
  shortcuts.open = false;
  shortcuts.singleKey = true;
  localStorage.clear();
});

describe("keyboard rows", () => {
  it("moves the mark with the arrows and with J and K, and stops at the ends", async () => {
    await render(Fixture, { enabled: true, log: vi.fn() });
    expect(marked()).toBeNull();

    await userEvent.keyboard("{ArrowDown}");
    expect(marked()).toContain("Alpha");
    await userEvent.keyboard("j");
    expect(marked()).toContain("Bravo");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(marked()).toContain("Charlie");
    await userEvent.keyboard("k");
    expect(marked()).toContain("Bravo");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(marked()).toContain("Alpha");
  });

  it("starts from the last row on ↑", async () => {
    await render(Fixture, { enabled: true, log: vi.fn() });
    await userEvent.keyboard("{ArrowUp}");
    expect(marked()).toContain("Charlie");
  });

  it("opens the marked row on Enter and leaves it on Esc", async () => {
    const log = vi.fn();
    await render(Fixture, { enabled: true, log });

    await userEvent.keyboard("{Enter}");
    expect(log).not.toHaveBeenCalled();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(log).toHaveBeenCalledWith("open Bravo");

    await userEvent.keyboard("{Escape}");
    expect(marked()).toBeNull();
  });

  it("acts on the marked row with its keys, Backspace and Delete alike", async () => {
    const log = vi.fn();
    await render(Fixture, { enabled: true, log });

    await userEvent.keyboard("{ArrowDown}e");
    await userEvent.keyboard("{Backspace}");
    await userEvent.keyboard("{Delete}");

    expect(log.mock.calls.map(([what]) => what)).toEqual([
      "edit Alpha",
      "delete Alpha",
      "delete Alpha"
    ]);
  });

  it("acts on the row under the pointer when none is marked, and the mark wins over it", async () => {
    const log = vi.fn();
    await render(Fixture, { enabled: true, log });

    await userEvent.hover(row("Charlie"));
    await userEvent.keyboard("e");
    expect(log).toHaveBeenLastCalledWith("edit Charlie");

    await userEvent.keyboard("{ArrowDown}e");
    expect(log).toHaveBeenLastCalledWith("edit Alpha");
  });

  it("ignores its keys while typing in a field", async () => {
    const log = vi.fn();
    const screen = await render(Fixture, { enabled: true, log });
    await userEvent.click(screen.getByRole("textbox", { name: "Search" }));
    await userEvent.keyboard("jek{ArrowDown}{Enter}");

    expect(marked()).toBeNull();
    expect(log).not.toHaveBeenCalled();
    await expect.element(screen.getByRole("textbox", { name: "Search" })).toHaveValue("jek");
  });

  it("does not repeat an action while its key is held", async () => {
    const log = vi.fn();
    await render(Fixture, { enabled: true, log });
    await userEvent.keyboard("{ArrowDown}");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "e", repeat: true, bubbles: true }));
    expect(log).not.toHaveBeenCalled();
    await userEvent.keyboard("e");
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("ignores its keys with a modifier held", async () => {
    const log = vi.fn();
    await render(Fixture, { enabled: true, log });

    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Control>}e{/Control}");
    expect(log).not.toHaveBeenCalled();
  });

  it("drops the mark when its row leaves the list", async () => {
    const screen = await render(Fixture, { enabled: true, log: vi.fn() });
    await userEvent.keyboard("{ArrowDown}");
    expect(marked()).toContain("Alpha");

    await screen.rerender({ names: ["Bravo", "Charlie"] });
    await expect.poll(marked).toBeNull();
  });

  it("shows each action's key in the row menu and runs it from there, closing the menu", async () => {
    const log = vi.fn();
    const screen = await render(Fixture, { enabled: true, log });

    await userEvent.click(screen.getByRole("button", { name: "Actions for Bravo" }));
    await expect.element(browser.getByRole("menuitem", { name: /Edit/ })).toBeVisible();
    await expect.element(browser.getByText("E", { exact: true })).toBeVisible();

    await userEvent.keyboard("e");
    expect(log).toHaveBeenCalledWith("edit Bravo");
    // the closed menu lingers while it animates out
    await expect.element(browser.getByRole("menu")).toHaveAttribute("data-state", "closed");
  });

  it("lists its sections on the sheet while the list is mounted", async () => {
    await render(Fixture, { enabled: true, log: vi.fn() });
    await userEvent.keyboard("?");

    const sheet = browser.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect.element(sheet.getByRole("heading", { name: "On the Test list" })).toBeVisible();
    await expect.element(sheet.getByRole("heading", { name: "On a row" })).toBeVisible();
    await expect.element(sheet.getByText("Move between rows")).toBeVisible();
    await expect.element(sheet.getByText("Delete…")).toBeVisible();
  });

  it("is on unless a list passes enabled: false", async () => {
    await render(Fixture, { log: vi.fn() });
    await userEvent.keyboard("{ArrowDown}");
    expect(marked()).toContain("Alpha");
  });

  describe("with the single-key switch off (ADR-0052 rule 5)", () => {
    it("ignores J, K and the action keys, Backspace and Delete included, and keeps the arrows, Enter and Esc", async () => {
      const log = vi.fn();
      shortcuts.setSingleKey(false);
      await render(Fixture, { log });

      await userEvent.keyboard("je{Backspace}{Delete}k");
      expect(marked()).toBeNull();
      expect(log).not.toHaveBeenCalled();

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");
      expect(marked()).toContain("Bravo");
      await userEvent.keyboard("j");
      expect(marked()).toContain("Bravo");
      await userEvent.keyboard("e{Backspace}");
      expect(log).not.toHaveBeenCalled();
      await userEvent.keyboard("{Enter}");
      expect(log).toHaveBeenCalledWith("open Bravo");
      await userEvent.keyboard("{ArrowUp}");
      expect(marked()).toContain("Alpha");
      await userEvent.keyboard("{Escape}");
      expect(marked()).toBeNull();
    });

    it("does not act on the row under the pointer, and drops the keys from the row menu", async () => {
      const log = vi.fn();
      shortcuts.setSingleKey(false);
      const screen = await render(Fixture, { log });

      await userEvent.hover(row("Charlie"));
      await userEvent.keyboard("e");
      expect(log).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Actions for Bravo" }));
      await expect.element(browser.getByRole("menuitem", { name: "Edit" })).toBeVisible();
      expect(document.querySelector("[data-slot='dropdown-menu-shortcut']")).toBeNull();
      await userEvent.keyboard("e");
      expect(log).not.toHaveBeenCalled();
    });

    it("keeps the sections on the sheet, with the single-key rows marked off", async () => {
      localStorage.setItem(SINGLE_KEY_STORAGE, "off");
      await render(Fixture, { log: vi.fn() });
      shortcuts.open = true;

      const sheet = browser.getByRole("dialog", { name: "Keyboard shortcuts" });
      await expect.element(sheet.getByRole("heading", { name: "On a row" })).toBeVisible();
      await expect.element(sheet.getByText("Edit")).toBeVisible();
      // ?, /, Edit and Delete…; the arrows stay, so "Move between rows" only loses its J and K
      await expect.element(sheet.getByText("Off", { exact: true })).toHaveLength(4);
      await expect.element(sheet.getByText("Move between rows")).toBeVisible();
      await expect.element(sheet.getByText("J K off")).toBeVisible();
    });
  });

  it("does nothing when off: no mark, no keys, no sections, no key in the menu", async () => {
    const log = vi.fn();
    const screen = await render(Fixture, { enabled: false, log });

    await userEvent.keyboard("{ArrowDown}je{Enter}");
    expect(marked()).toBeNull();
    expect(log).not.toHaveBeenCalled();
    expect(document.querySelector("[data-row-id]")).toBeNull();

    await userEvent.keyboard("?");
    const sheet = browser.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect.element(sheet.getByRole("heading", { name: "Everywhere" })).toBeVisible();
    await expect.element(sheet.getByRole("heading", { level: 3 })).toHaveLength(1);

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Actions for Bravo" }));
    await expect.element(browser.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    expect(document.querySelector("[data-slot='dropdown-menu-shortcut']")).toBeNull();
  });

  describe("with a layer (ADR-0053)", () => {
    const panel = () => document.querySelector<HTMLElement>('[data-layer-frame="panel"]');

    it("leaves every key to an open layer, and takes them back once it closes", async () => {
      const log = vi.fn();
      await browser.viewport(1440, 900);
      const screen = await render(Fixture, { enabled: true, log, layer: true });
      await userEvent.keyboard("{ArrowDown}");
      expect(marked()).toContain("Alpha");

      await screen.getByRole("button", { name: "Filter" }).click();
      await expect.element(panel()).toBeVisible();
      await userEvent.keyboard("j{ArrowDown}e{Enter}");
      expect(marked()).toContain("Alpha");
      expect(log).not.toHaveBeenCalled();

      // Esc is the layer's: it closes, and the mark stays
      await userEvent.keyboard("{Escape}");
      await expect.poll(panel).toBeNull();
      expect(marked()).toContain("Alpha");

      await userEvent.keyboard("j");
      expect(marked()).toContain("Bravo");
    });

    it("leaves Enter to a layer's button that focus reached by Tab", async () => {
      const log = vi.fn();
      await browser.viewport(1440, 900);
      const screen = await render(Fixture, { enabled: true, log, layer: true });
      await userEvent.keyboard("{ArrowDown}");

      // from the search field to the Filter button next to it
      await screen.getByRole("textbox", { name: "Search" }).click();
      await userEvent.keyboard("{Tab}");
      await expect.element(browser.getByRole("button", { name: "Filter" })).toHaveFocus();
      await userEvent.keyboard("{Enter}");

      await expect.element(panel()).toBeVisible();
      expect(log).not.toHaveBeenCalled();
    });

    it("opens the marked row on Enter after the panel was closed with a click outside", async () => {
      const log = vi.fn();
      await browser.viewport(1440, 900);
      const screen = await render(Fixture, { enabled: true, log, layer: true });
      await userEvent.keyboard("{ArrowDown}");

      await screen.getByRole("button", { name: "Filter" }).click();
      await expect.element(panel()).toBeVisible();
      // the click that closes the panel is only that: the row beneath does not open
      await screen.getByText("Charlie").click();
      await expect.poll(panel).toBeNull();
      expect(log).not.toHaveBeenCalled();

      await userEvent.keyboard("{Enter}");
      expect(log).toHaveBeenCalledWith("open Alpha");
    });
  });
});
