import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: Fixture } = await import("./rail-tooltips-fixture.svelte");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// what is open: one that is fading out after the pointer left is still in the document
const tip = () =>
  [...document.querySelectorAll("[data-slot='tooltip-content']")]
    .filter((content) => content.getAttribute("data-state") !== "closed")
    .map((content) => content.textContent?.trim())
    .join("");

afterEach(() => document.body.replaceChildren());

describe("rail tooltips", () => {
  it("open after half a second, not on the first touch of the pointer", async () => {
    const screen = await render(Fixture);

    await userEvent.hover(screen.getByRole("button", { name: "One" }));
    await wait(300);
    expect(tip()).toBe("");
    await expect.poll(tip, { timeout: 3000 }).toBe("One tip");
  });

  it("show a neighbour's at once while one is showing", async () => {
    const screen = await render(Fixture);

    await userEvent.hover(screen.getByRole("button", { name: "One" }));
    await expect.poll(tip, { timeout: 3000 }).toBe("One tip");

    await userEvent.hover(screen.getByRole("button", { name: "Two" }));
    await wait(100);
    expect(tip()).toBe("Two tip");
  });
});
