import { describe, expect, it, vi } from "vitest";

// Isolated renders don't load the global stylesheet. This file measures real
// layout and computed styles, so it needs Tailwind's classes and the base
// layer applied; it lives apart from page.svelte.test.ts so that file's
// renders stay unstyled.
import "../../../app.css";

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} })
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => (path.startsWith("/") ? path : `/${path}`)
}));
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/activate") }
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const noCheckedCode = { user: null, step: undefined, email: undefined };

describe("activate page layout", () => {
  // The boxes share the column's edges with every other field and button.
  it("spans the code boxes across the field, edge to edge with Verify code", async () => {
    const screen = await render(Page, {
      data: noCheckedCode,
      form: { step: "code", email: "a@example.com" }
    });
    await expect.element(screen.getByLabelText("Code")).toBeVisible();
    const slots = screen.container.querySelectorAll("[data-slot=input-otp-slot]");
    const button = screen.getByRole("button", { name: "Verify code" }).element();

    const first = slots[0]!.getBoundingClientRect();
    const last = slots[slots.length - 1]!.getBoundingClientRect();
    const verify = button.getBoundingClientRect();
    expect(Math.abs(first.left - verify.left)).toBeLessThan(1);
    expect(Math.abs(last.right - verify.right)).toBeLessThan(1);
  });

  // The same action as the code step's link, so it looks like one, not like a
  // second button beside Set password (the base layer borders a bare button).
  it("draws the password step's way out as a link, like the code step's", async () => {
    const screen = await render(Page, {
      data: { user: null, step: "password", email: "a@example.com" },
      form: null
    });
    const style = getComputedStyle(
      screen.getByRole("button", { name: "Use a different email" }).element()
    );

    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.borderTopWidth).toBe("0px");
    expect(style.paddingLeft).toBe("0px");
  });
});
