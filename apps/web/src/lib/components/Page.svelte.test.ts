import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { page as browser } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the width caps are styles.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./Page.svelte");

const body = createRawSnippet(() => ({ render: () => `<p data-testid="body">Body</p>` }));

/** The rendered width and left edge of the page body inside a 2400px-wide window. */
async function measure(width?: "narrow" | "default" | "full") {
  await browser.viewport(2400, 900);
  const screen = await render(Page, { width, children: body });
  const box = screen.getByTestId("body").element().parentElement!.getBoundingClientRect();
  return { width: box.width, left: box.left, window: document.documentElement.clientWidth };
}

afterEach(() => browser.viewport(414, 896));

describe("Page", () => {
  it("caps a narrow page at 48rem and centres it", async () => {
    const box = await measure("narrow");
    expect(box.width).toBe(768);
    expect(box.left).toBeCloseTo((box.window - 768) / 2, 0);
  });

  it("caps a default page at 90rem and centres it", async () => {
    const box = await measure();
    expect(box.width).toBe(1440);
    expect(box.left).toBeCloseTo((box.window - 1440) / 2, 0);
  });

  it("leaves a full page uncapped", async () => {
    const box = await measure("full");
    expect(box.width).toBe(box.window);
    expect(box.left).toBe(0);
  });

  it("takes the whole width below the cap", async () => {
    await browser.viewport(600, 900);
    const screen = await render(Page, { width: "default", children: body });
    const box = screen.getByTestId("body").element().parentElement!.getBoundingClientRect();
    expect(box.width).toBe(document.documentElement.clientWidth);
  });
});
