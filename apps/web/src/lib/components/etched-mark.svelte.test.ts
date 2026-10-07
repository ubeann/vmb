import { describe, expect, it } from "vitest";

// The motion tokens and the global reduced-motion rule live in app.css, which
// isolated component renders don't otherwise load.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: EtchedMark } = await import("./EtchedMark.svelte");

describe("EtchedMark", () => {
  it("is decorative, takes the art's ratio and is filled with the etching token", async () => {
    const screen = await render(EtchedMark, {
      art: { image: "/mark.webp", ratio: 2 },
      class: "w-24"
    });
    const mark = screen.container.querySelector<HTMLElement>("[data-etched-mark]")!;

    expect(mark.getAttribute("aria-hidden")).toBe("true");
    const box = mark.getBoundingClientRect();
    expect(box.width / box.height).toBeCloseTo(2, 1);
    const style = getComputedStyle(mark);
    expect(style.maskImage).toContain("/mark.webp");
    expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("does not move unless asked to", async () => {
    const screen = await render(EtchedMark, { art: { image: "/mark.webp", ratio: 2 } });
    const mark = screen.container.querySelector<HTMLElement>("[data-etched-mark]")!;

    expect(mark.getAnimations()).toHaveLength(0);
  });

  it("is printed in once when revealed, and then rests", async () => {
    const screen = await render(EtchedMark, {
      art: { image: "/mark.webp", ratio: 2 },
      reveal: true
    });
    const mark = screen.container.querySelector<HTMLElement>("[data-etched-mark]")!;

    const [print, ...rest] = mark.getAnimations();
    expect(rest).toHaveLength(0);
    expect(print!.effect!.getTiming().iterations).toBe(1);
    await print!.finished;
    expect(print!.playState).toBe("finished");
  });
});
