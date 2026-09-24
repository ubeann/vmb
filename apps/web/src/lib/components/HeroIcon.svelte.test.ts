import { describe, expect, it } from "vitest";

const { render } = await import("vitest-browser-svelte");
const { default: HeroIcon } = await import("./HeroIcon.svelte");

describe("HeroIcon", () => {
  it("draws the mapped Lucide glyph, hidden from assistive tech by default", async () => {
    const screen = await render(HeroIcon, { name: "heroicon-o-truck" });

    const svg = screen.container.querySelector("svg");
    expect(svg?.dataset.icon).toBe("truck");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes a labelled image when given a label", async () => {
    const screen = await render(HeroIcon, { name: "heroicon-o-truck", label: "Trucking" });

    await expect.element(screen.getByRole("img", { name: "Trucking" })).toBeVisible();
  });

  it("draws the fallback glyph for an unmapped name", async () => {
    const screen = await render(HeroIcon, { name: "heroicon-o-academic-cap" });

    expect(screen.container.querySelector("svg")?.dataset.icon).toBe("shapes");
  });
});
