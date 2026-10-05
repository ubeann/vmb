import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

const { render } = await import("vitest-browser-svelte");
const { default: MotionDemo } = await import("./MotionDemo.svelte");

// The real media query, emulated in Chromium: the global CSS rule can't reach
// Svelte transitions (they run on the Web Animations API), so this checks the
// component's own `prefersReducedMotion` gate.
async function emulateReducedMotion(value: "reduce" | "no-preference") {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }]
  });
}

afterEach(async () => {
  await emulateReducedMotion("no-preference");
});

describe("MotionDemo", () => {
  it("animates the panel in when motion is allowed", async () => {
    await emulateReducedMotion("no-preference");
    const screen = await render(MotionDemo);

    await screen.getByRole("button", { name: "Show details" }).click();

    const panel = screen.getByTestId("motion-panel");
    await expect.element(panel).toBeVisible();
    expect(panel.element().getAnimations()).not.toHaveLength(0);
  });

  it("shows the panel without animating when the user prefers reduced motion", async () => {
    await emulateReducedMotion("reduce");
    const screen = await render(MotionDemo);

    await expect.element(screen.getByText(/Reduced motion is on/)).toBeVisible();
    await screen.getByRole("button", { name: "Show details" }).click();

    const panel = screen.getByTestId("motion-panel");
    await expect.element(panel).toBeVisible();
    expect(panel.element().getAnimations()).toHaveLength(0);
  });

  it("labels the loading indicator with text, not motion alone", async () => {
    const screen = await render(MotionDemo);

    await expect.element(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
