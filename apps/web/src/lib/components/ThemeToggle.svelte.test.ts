import { beforeEach, describe, expect, it } from "vitest";

const { userEvent } = await import("vitest/browser");
const { render } = await import("vitest-browser-svelte");
const { modeStorageKey, setMode } = await import("mode-watcher");
const { default: ThemeToggle } = await import("./ThemeToggle.svelte");

describe("ThemeToggle", () => {
  beforeEach(() => setMode("light"));

  it("names the switch it will make, starting from the light scheme", async () => {
    const screen = await render(ThemeToggle);

    await expect.element(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  });

  it("flips the scheme and its label on each press", async () => {
    const screen = await render(ThemeToggle);

    await screen.getByRole("button", { name: "Switch to dark mode" }).click();

    await expect
      .element(screen.getByRole("button", { name: "Switch to light mode" }))
      .toBeVisible();
    expect(localStorage.getItem(modeStorageKey.current)).toBe("dark");

    await screen.getByRole("button", { name: "Switch to light mode" }).click();

    await expect.element(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
    expect(localStorage.getItem(modeStorageKey.current)).toBe("light");
  });

  it("is operable from the keyboard, with its glyphs hidden from assistive tech", async () => {
    const screen = await render(ThemeToggle);
    const button = screen.getByRole("button", { name: "Switch to dark mode" });

    (button.element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("button", { name: "Switch to light mode" }))
      .toBeVisible();

    await userEvent.keyboard(" ");
    await expect.element(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();

    for (const svg of button.element().querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
