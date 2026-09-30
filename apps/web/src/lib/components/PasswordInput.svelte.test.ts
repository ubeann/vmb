import { describe, expect, it } from "vitest";

import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: PasswordInput } = await import("./PasswordInput.svelte");

describe("PasswordInput", () => {
  it("leaves room for a password-manager badge beside the eye toggle", async () => {
    const screen = await render(PasswordInput, { id: "password", name: "password" });
    const input = screen.container.querySelector("input")!;
    const toggle = screen.container.querySelector<HTMLButtonElement>(
      "[data-slot='password-toggle']"
    )!;
    const wrapper = input.parentElement!;
    const before = wrapper.getBoundingClientRect();
    const badge = document.createElement("span");
    badge.style.cssText = "position:absolute;right:8px;top:10px;width:32px;height:24px";
    input.after(badge);

    const toggleBox = toggle.getBoundingClientRect();
    const badgeBox = badge.getBoundingClientRect();
    const after = wrapper.getBoundingClientRect();

    expect(badgeBox.left - toggleBox.right).toBeGreaterThanOrEqual(8);
    expect(after.height).toBe(before.height);
    expect(after.width).toBe(before.width);
    expect(input.getBoundingClientRect().right - toggleBox.left).toBeLessThanOrEqual(
      Number.parseFloat(getComputedStyle(input).paddingRight)
    );
  });
});
