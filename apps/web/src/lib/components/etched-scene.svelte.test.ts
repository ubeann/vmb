import type { Component } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import skyParts from "$lib/assets/auth/vmb-sky-parts.json";
import etchingParts from "$lib/assets/auth/vmb-etching-parts.json";

// The motion tokens and the global reduced-motion rule live in app.css, which
// isolated component renders don't otherwise load.
import "../../app.css";

const { render } = await import("vitest-browser-svelte");
const { default: EtchedScene } = await import("./EtchedScene.svelte");
const { default: EtchedSky } = await import("./EtchedSky.svelte");

async function emulateReducedMotion(value: "reduce" | "no-preference") {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }]
  });
}

type Parts = Record<string, { box: number[] }>;
const scenes: Array<[string, Component, Parts]> = [
  ["EtchedScene", EtchedScene, etchingParts.parts],
  ["EtchedSky", EtchedSky, skyParts.parts]
];

// AuthShell sizes both boxes; give them a desktop size here.
async function renderScene(scene: Component) {
  const screen = await render(scene);
  const root = screen.container.firstElementChild as HTMLElement;
  root.style.width = "1440px";
  root.style.height = "480px";
  const parts = new Map(
    [...root.querySelectorAll<HTMLElement>("[data-part]")].map((el) => [el.dataset.part!, el])
  );
  return { root, parts, plate: root.querySelector<HTMLElement>("[data-plate]")! };
}

afterEach(() => emulateReducedMotion("no-preference"));

// On a slow connection the plate, the biggest file, used to land after the parts,
// which then hung on bare paper (#260). The parts' box is masked by the plate
// plus a solid layer: a browser that waits for a pending mask paints nothing
// until the plate is there, and the solid layer keeps every part fully visible
// after it. (Chromium and Firefox wait; WebKit paints the parts regardless.)
describe("EtchedScene plate gate", () => {
  it("masks the parts' box with the plate and a solid layer", async () => {
    const { plate } = await renderScene(EtchedScene);
    const style = getComputedStyle(plate);

    expect(style.maskImage).toMatch(/^url\(.*vmb-etching-\d+\.webp.*\), linear-gradient\(/);
    expect(style.maskComposite).toBe("add, add");
  });
});

describe.each(scenes)("%s moving parts", (_, scene, manifest) => {
  it("draws every part in the manifest", async () => {
    const { parts } = await renderScene(scene);

    expect([...parts.keys()].sort()).toEqual(Object.keys(manifest).sort());
  });

  it("brings each part to rest at its place on the plate", async () => {
    const { root, parts, plate } = await renderScene(scene);
    for (const animation of root.getAnimations({ subtree: true })) animation.finish();

    const frame = plate.getBoundingClientRect();
    for (const [name, { box }] of Object.entries(manifest)) {
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
