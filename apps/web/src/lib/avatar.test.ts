import { describe, expect, it } from "vitest";
import { avatarSvg } from "./avatar.js";

describe("avatarSvg", () => {
  it("draws a bot as an SVG", () => {
    expect(avatarSvg("u-1", { theme: "light" })).toMatch(/^<svg[^>]*viewBox="0 0 100 100"/);
  });

  it("gives the same user the same picture every time", () => {
    expect(avatarSvg("u-1", { theme: "dark" })).toBe(avatarSvg("u-1", { theme: "dark" }));
  });

  it("tells different users apart", () => {
    const seeds = ["u-1", "u-2", "u-3", "u-4", "u-5", "u-6"];
    const pictures = new Set(seeds.map((seed) => avatarSvg(seed, { theme: "light" })));

    expect(pictures.size).toBeGreaterThan(3);
  });

  it("keeps a user's face across themes and swaps the tones", () => {
    const light = avatarSvg("u-1", { theme: "light" });
    const dark = avatarSvg("u-1", { theme: "dark" });
    const fills = (svg: string) => new Set(svg.match(/fill="#[0-9a-f]{6}"/g));

    expect(light).not.toBe(dark);
    // The glow's fill is one of the pair's two colours, never the other theme's.
    expect([...fills(light)].filter((fill) => !fills(dark).has(fill)).length).toBeGreaterThan(0);
    expect(light.replace(/fill="#[0-9a-f]{6}"/g, "")).toBe(
      dark.replace(/fill="#[0-9a-f]{6}"/g, "")
    );
  });

  it("animates only when asked, and the animation honours reduced motion", () => {
    const still = avatarSvg("u-1", { theme: "light" });
    const moving = avatarSvg("u-1", { theme: "light", animated: true });

    expect(still).not.toContain("@keyframes");
    expect(moving).toContain("@keyframes");
    expect(moving).toContain("prefers-reduced-motion: no-preference");
  });
});
