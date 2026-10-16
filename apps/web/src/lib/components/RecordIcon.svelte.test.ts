import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: RecordIcon } = await import("./RecordIcon.svelte");

describe("RecordIcon", () => {
  it("draws the stored Lucide glyph, hidden from assistive tech by default", async () => {
    const screen = await render(RecordIcon, { name: "truck" });

    const svg = screen.container.querySelector("svg");
    expect(svg?.dataset.icon).toBe("truck");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes a labelled image when given a label", async () => {
    const screen = await render(RecordIcon, { name: "truck", label: "Trucking" });

    await expect.element(screen.getByRole("img", { name: "Trucking" })).toBeVisible();
  });

  it("draws the fallback glyph for a name outside the catalogue", async () => {
    for (const name of ["heroicon-o-arrow-left", "not-an-icon", ""]) {
      const screen = await render(RecordIcon, { name });

      expect(screen.container.querySelector("svg")?.dataset.icon).toBe("shapes");
      screen.unmount();
    }
  });
});
