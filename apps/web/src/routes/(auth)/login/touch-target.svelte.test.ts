import { describe, expect, it, vi } from "vitest";

// Isolated renders don't load the global stylesheet. This file measures real
// layout, so it needs Tailwind's classes applied; it lives apart from
// page.svelte.test.ts so that file's renders stay unstyled.
import "../../../app.css";

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} })
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/login") }
}));

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

describe("login page touch targets", () => {
  it("gives Remember me a target of at least 44px", async () => {
    const screen = await render(Page, { form: null });
    const target = screen.getByText("Remember me").element().getBoundingClientRect();

    expect(target.height).toBeGreaterThanOrEqual(44);
  });
});
