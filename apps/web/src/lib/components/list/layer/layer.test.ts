import { describe, expect, it } from "vitest";
import { fitsBeside, whenSteady } from "./layer.js";

describe("fitsBeside", () => {
  // The panel aligns to its button's right edge; a 560px picker opens 12px to
  // its left and keeps 8px off the window's edge.
  it("fits where a 20rem panel leaves 580px to its left", () => {
    expect(fitsBeside(900, 560)).toBe(true);
    expect(fitsBeside(899, 560)).toBe(false);
  });

  it("measures from the button, so the sidebar's width counts", () => {
    // 1024px window: with the sidebar the toolbar ends nearer the edge than
    // the window, without it the button sits further left in a narrow column
    expect(fitsBeside(1000, 560)).toBe(true);
    expect(fitsBeside(744, 560)).toBe(false);
  });
});

describe("whenSteady", () => {
  function clock() {
    let now = 0;
    const queue: (() => void)[] = [];
    return {
      now: () => now,
      frame: (fn: () => void) => queue.push(fn),
      tick(ms = 16) {
        now += ms;
        queue.splice(0).forEach((fn) => fn());
      }
    };
  }

  it("opens once the window and the page agree on the width, a scrollbar apart", () => {
    const time = clock();
    let gap = 266;
    let opened = 0;
    whenSteady(() => opened++, { gap: () => gap, ...time });

    time.tick();
    expect(opened).toBe(0);
    gap = 15;
    time.tick();
    time.tick();
    expect(opened).toBe(0);
    time.tick();
    expect(opened).toBe(1);
    time.tick();
    expect(opened).toBe(1);
  });

  it("waits while the gap still shrinks, as a closing panel's does on a phone", async () => {
    // a phone has no scrollbar: 11px a frame into a closing panel is not one
    const time = clock();
    const gaps = [266, 120, 40, 11, 4, 0, 0, 0, 0];
    let opened = 0;
    let at = -1;
    whenSteady(() => (at = opened++), { gap: () => gaps.shift() ?? 0, ...time });

    for (let i = 0; i < 5; i++) time.tick();
    expect(opened).toBe(0);
    for (let i = 0; i < 3; i++) time.tick();
    expect(opened).toBe(1);
    expect(at).toBe(0);
  });

  it("waits until the panel it replaces has left the page", () => {
    // the closing panel's overflow can hold steady at a scrollbar's width
    const time = clock();
    let gone = false;
    let opened = 0;
    whenSteady(() => opened++, { gap: () => 11, ready: () => gone, ...time });

    for (let i = 0; i < 10; i++) time.tick();
    expect(opened).toBe(0);
    gone = true;
    for (let i = 0; i < 3; i++) time.tick();
    expect(opened).toBe(1);
  });

  it("opens after a second at most", () => {
    const time = clock();
    let opened = 0;
    whenSteady(() => opened++, { gap: () => 266, ...time });

    for (let i = 0; i < 62; i++) time.tick();
    expect(opened).toBe(0);
    time.tick(20);
    expect(opened).toBe(1);
  });

  it("can be called off before it opens", () => {
    const time = clock();
    let opened = 0;
    const cancel = whenSteady(() => opened++, { gap: () => 266, ...time });

    cancel();
    time.tick(2000);
    expect(opened).toBe(0);
  });
});
