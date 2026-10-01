import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import { ERROR_SCENES } from "$lib/error-page.js";

// The motion tokens and the global reduced-motion rule live in app.css, which
// isolated component renders don't otherwise load.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: EtchedVignette } = await import("./EtchedVignette.svelte");

async function emulateReducedMotion(value: "reduce" | "no-preference") {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }]
  });
}

async function renderScene(scene: (typeof ERROR_SCENES)[keyof typeof ERROR_SCENES]) {
  const screen = await render(EtchedVignette, { scene });
  const root = screen.container.firstElementChild as HTMLElement;
  const parts = new Map(
    [...root.querySelectorAll<HTMLElement>("[data-part]")].map((el) => [el.dataset.part!, el])
  );
  return { root, parts, plate: root.querySelector<HTMLElement>("[data-plate]")! };
}

afterEach(() => emulateReducedMotion("no-preference"));

describe.each(Object.values(ERROR_SCENES))("EtchedVignette $name", (scene) => {
  it("draws every part in the manifest, and marks the box decorative", async () => {
    const { root, parts } = await renderScene(scene);

    expect([...parts.keys()].sort()).toEqual(Object.keys(scene.parts).sort());
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });

  it("preloads the plate first, high priority, as a CSS mask is fetched (#260)", async () => {
    await renderScene(scene);

    const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"]')];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([scene.image]);
    expect(links[0]!.as).toBe("image");
    expect(links[0]!.getAttribute("fetchpriority")).toBe("high");
    expect(links[0]!.crossOrigin).toBe("anonymous");
  });

  it("brings each part to rest at its place on the plate", async () => {
    const { root, parts, plate } = await renderScene(scene);
    for (const animation of root.getAnimations({ subtree: true })) animation.finish();
    // The road's truck leaves the plate, so its box is where it waits before it drives off.
    for (const animation of parts.get("truck")?.getAnimations() ?? []) animation.currentTime = 1500;

    const frame = plate.getBoundingClientRect();
    for (const [name, { box }] of Object.entries(scene.parts)) {
      const rect = parts.get(name)!.getBoundingClientRect();
      const [left, top, width, height] = box as [number, number, number, number];
      expect(rect.left - frame.left, name).toBeCloseTo((left / 100) * frame.width, 0);
      expect(rect.top - frame.top, name).toBeCloseTo((top / 100) * frame.height, 0);
      expect(rect.width, name).toBeCloseTo((width / 100) * frame.width, 0);
      expect(rect.height, name).toBeCloseTo((height / 100) * frame.height, 0);
    }
  });

  // A layer whose mask fails to resolve paints its whole box in ink.
  it("draws every inked layer through its art", async () => {
    const { root } = await renderScene(scene);

    for (const el of [root, ...root.querySelectorAll("*")]) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(el, pseudo);
        if (pseudo && style.content === "none") continue;
        if (style.backgroundColor === "rgba(0, 0, 0, 0)") continue;
        expect(style.maskImage, `${el.className} ${pseudo ?? ""}`).toContain("url(");
      }
    }
  });

  it("moves every part once, settling within 4 s of first paint", async () => {
    const { parts } = await renderScene(scene);

    for (const [name, part] of parts) {
      const animations = part.getAnimations({ subtree: true });
      expect(animations.length, name).toBeGreaterThan(0);
      for (const animation of animations) {
        const timing = animation.effect!.getComputedTiming();
        expect(timing.iterations, name).toBe(1);
        expect(Number(timing.endTime), name).toBeLessThanOrEqual(4000);
      }
    }
  });

  it("shows the finished frame when the user prefers reduced motion", async () => {
    await emulateReducedMotion("reduce");
    const { root } = await renderScene(scene);

    expect(root.getAnimations({ subtree: true })).toEqual([]);
  });
});

describe("EtchedVignette road", () => {
  it("leaves the truck out of the finished frame, with or without motion", async () => {
    const { root, parts } = await renderScene(ERROR_SCENES.road);
    for (const animation of root.getAnimations({ subtree: true })) animation.finish();
    expect(getComputedStyle(parts.get("truck")!).opacity).toBe("0");

    await emulateReducedMotion("reduce");
    const reduced = await renderScene(ERROR_SCENES.road);
    expect(getComputedStyle(reduced.parts.get("truck")!).opacity).toBe("0");
  });
});

describe("EtchedVignette gate", () => {
  it("closes both leaves, and locks the gate after they are shut", async () => {
    const { root, parts } = await renderScene(ERROR_SCENES.gate);
    for (const animation of root.getAnimations({ subtree: true })) animation.finish();

    for (const leaf of ["leaf-left", "leaf-right"]) {
      expect(getComputedStyle(parts.get(leaf)!).rotate, leaf).toMatch(/^(none|y 0deg)$/);
    }
    const end = (name: string) =>
      Number(parts.get(name)!.getAnimations()[0]!.effect!.getComputedTiming().endTime);
    const lockStart = Number(
      parts.get("lock")!.getAnimations()[0]!.effect!.getComputedTiming().delay
    );
    expect(lockStart).toBeGreaterThanOrEqual(end("leaf-left"));
    expect(lockStart).toBeGreaterThanOrEqual(end("leaf-right"));
  });
});
