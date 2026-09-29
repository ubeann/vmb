import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

// The global reduced-motion rule lives in the base layer, which isolated
// component renders don't otherwise load.
import "../../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: Settings } = await import("./settings.svelte");
const { default: Copy } = await import("./copy.svelte");
const { default: Check } = await import("./check.svelte");
const { default: RefreshCw } = await import("./refresh-cw.svelte");

// The global CSS rule (ADR-0035 rule 6) collapses `transition`/`animation`
// durations to 0.01ms under `prefers-reduced-motion: reduce`. These icons
// animate with plain CSS transitions, so that rule reaches them directly —
// unlike Svelte transitions, no `prefersReducedMotion` read is needed here.
async function emulateReducedMotion(value: "reduce" | "no-preference") {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }]
  });
}

function durationMs(duration: string) {
  const value = Number.parseFloat(duration);
  return duration.trim().endsWith("ms") ? value : value * 1000;
}

afterEach(async () => {
  await emulateReducedMotion("no-preference");
});

const icons = [
  { name: "settings", Component: Settings, selector: "svg" },
  { name: "copy", Component: Copy, selector: ".copy-rect" },
  { name: "check", Component: Check, selector: ".check-path" },
  { name: "refresh-cw", Component: RefreshCw, selector: "svg" }
];

describe.each(icons)("movingicons/$name", ({ Component, selector }) => {
  it("is hidden from assistive tech by default", async () => {
    const screen = await render(Component);

    const root = screen.container.querySelector("span");
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(root?.getAttribute("role")).toBeNull();
  });

  it("exposes a labelled image when given a label", async () => {
    const screen = await render(Component, { label: "Copied" });

    await expect.element(screen.getByRole("img", { name: "Copied" })).toBeVisible();
  });

  it("does not self-trigger on hover", async () => {
    const screen = await render(Component);

    const target = screen.container.querySelector(selector);
    expect(target?.classList.contains("animate")).toBe(false);
    target?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(target?.classList.contains("animate")).toBe(false);
  });

  it("runs its CSS transition at authored speed when motion is allowed", async () => {
    await emulateReducedMotion("no-preference");
    const screen = await render(Component, { animate: true });

    const el = screen.container.querySelector(selector);
    expect(durationMs(getComputedStyle(el!).transitionDuration)).toBeGreaterThanOrEqual(100);
  });

  it("collapses its CSS transition under prefers-reduced-motion: reduce", async () => {
    await emulateReducedMotion("reduce");
    const screen = await render(Component, { animate: true });

    const el = screen.container.querySelector(selector);
    expect(durationMs(getComputedStyle(el!).transitionDuration)).toBeLessThanOrEqual(0.02);
  });
});

it("collapses Check's keyframe animation under prefers-reduced-motion: reduce", async () => {
  const screen = await render(Check, { animate: true });
  const path = screen.container.querySelector(".check-path");

  expect(path).not.toBeNull();
  expect(durationMs(getComputedStyle(path!).animationDuration)).toBeGreaterThanOrEqual(100);

  await emulateReducedMotion("reduce");
  expect(durationMs(getComputedStyle(path!).animationDuration)).toBeLessThanOrEqual(0.02);
});
