import { describe, expect, it } from "vitest";
import "../../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: MotionTokens } = await import("./MotionTokens.svelte");

describe("MotionTokens", () => {
  it("shows each token's value from the live stylesheet", async () => {
    const screen = await render(MotionTokens);

    const row = screen.getByRole("row", { name: /--duration-panel/ });
    await expect.poll(() => row.element().textContent).toContain("220ms");
    await expect.element(screen.getByText(/^linear\(0, 0\.098/)).toBeVisible();
  });

  it("draws each easing dot with its own utility", async () => {
    const screen = await render(MotionTokens);

    await screen.getByRole("button", { name: "Play easings" }).click();
    await expect.element(screen.getByRole("button", { name: "Reset easings" })).toBeVisible();

    const timing = screen
      .getByTestId("easing-dot")
      .elements()
      .map((dot) => getComputedStyle(dot).transitionTimingFunction);
    expect(timing[0]).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(timing[3]).toMatch(/^linear\(/);
  });
});
