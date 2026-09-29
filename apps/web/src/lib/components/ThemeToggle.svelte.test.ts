import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

// The global reduced-motion rule lives in the base layer, which isolated
// component renders don't otherwise load.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { modeStorageKey, resetMode } = await import("mode-watcher");
const { default: ThemeToggle } = await import("./ThemeToggle.svelte");

const stored = () => localStorage.getItem(modeStorageKey.current);

async function emulateReducedMotion(value: "reduce" | "no-preference") {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }]
  });
}

describe("ThemeToggle", () => {
  beforeEach(() => resetMode());
  afterEach(() => emulateReducedMotion("no-preference"));

  it("opens a Light / Dark / System menu with the current choice checked", async () => {
    const screen = await render(ThemeToggle);

    await screen.getByRole("button", { name: "Theme" }).click();

    await expect.element(screen.getByRole("menuitemradio", { name: "Light" })).toBeVisible();
    await expect.element(screen.getByRole("menuitemradio", { name: "Dark" })).toBeVisible();
    await expect
      .element(screen.getByRole("menuitemradio", { name: "System" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("persists a choice and can return to the system scheme", async () => {
    const screen = await render(ThemeToggle);

    await screen.getByRole("button", { name: "Theme" }).click();
    await screen.getByRole("menuitemradio", { name: "Dark" }).click();
    expect(stored()).toBe("dark");

    await screen.getByRole("button", { name: "Theme" }).click();
    await expect
      .element(screen.getByRole("menuitemradio", { name: "Dark" }))
      .toHaveAttribute("aria-checked", "true");

    await screen.getByRole("menuitemradio", { name: "System" }).click();
    expect(stored()).toBe("system");
  });

  it("is operable from the keyboard, with its glyphs hidden from assistive tech", async () => {
    const screen = await render(ThemeToggle);
    const trigger = screen.getByRole("button", { name: "Theme" });

    (trigger.element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("menuitemradio", { name: "Light" })).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    await expect.poll(stored).toBe("dark");

    for (const svg of trigger.element().querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("animates the incoming glyph when a choice changes the scheme, not under reduced motion", async () => {
    const screen = await render(ThemeToggle);
    const trigger = screen.getByRole("button", { name: "Theme" });
    const duration = (glyph: string) =>
      getComputedStyle(trigger.element().querySelector(`svg.${glyph}`)!).animationDuration;

    expect(duration("moon")).toBe("0s");

    await trigger.click();
    await screen.getByRole("menuitemradio", { name: "Dark" }).click();
    expect(duration("moon")).toBe("0.3s");
    expect(duration("sun")).toBe("0s");

    await emulateReducedMotion("reduce");
    await expect.poll(() => Number.parseFloat(duration("moon"))).toBeLessThan(0.001);
  });

  it("keeps the glyph still when a choice leaves the scheme unchanged", async () => {
    const screen = await render(ThemeToggle);
    const trigger = screen.getByRole("button", { name: "Theme" });

    await trigger.click();
    await screen.getByRole("menuitemradio", { name: "Light" }).click();

    for (const svg of trigger.element().querySelectorAll("svg")) {
      expect(getComputedStyle(svg).animationDuration).toBe("0s");
    }
  });
});
