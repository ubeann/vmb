import { afterEach, describe, expect, it } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the frames are styles.
import "../../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

const { render } = await import("vitest-browser-svelte");
const { default: LayerDemo } = await import("./LayerDemo.svelte");

// The kit's layer (ADR-0053), through the /design-system demo that holds a
// small filter in it: a Status filter at the top level, an Updated step with
// presets, and its custom range as a step or as a picker beside the panel.

const find = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T & HTMLElement>(selector);
const trigger = () => find("[data-layer-trigger]")!;
const panel = () => find("[data-layer-frame=panel]");
const modal = () => find("[data-layer-frame=modal]");
const picker = () => find("[data-layer-picker]");
const layer = () => (panel() ?? modal())!;
const title = () => layer().querySelector<HTMLElement>("[data-layer-title]")!.textContent!.trim();
const rect = (el: Element) => {
  const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
  return { left, right, top, bottom, width, height };
};
// a step's edges, once its entrance motion has settled
async function settled(el: HTMLElement | null) {
  expect(el).not.toBeNull();
  await Promise.all(el!.getAnimations({ subtree: true }).map((a) => a.finished));
  return el!;
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// a handover waits 200ms for the resize to settle, then a frame or two
const handover = () => wait(450);
const halfPicked = () =>
  Boolean(layerOrPicker().querySelector("[data-range-calendar-day][data-selected]"));
const layerOrPicker = () => (picker() ?? layer())!;

async function openLayer() {
  trigger().click();
  await expect.poll(() => panel() ?? modal()).not.toBeNull();
  return settled(layer());
}
async function openUpdated() {
  (layer().querySelector("[data-slot=filter-date-row]") as HTMLElement).click();
  await expect.poll(() => picker() ?? title()).not.toBe("Filters");
}
// picks today as the start of a range, leaving the end open
async function pickStart() {
  await expect
    .poll(() => layerOrPicker().querySelector("[data-range-calendar-day][data-today]"))
    .not.toBeNull();
  layerOrPicker().querySelector<HTMLElement>("[data-range-calendar-day][data-today]")!.click();
  await expect.poll(halfPicked).toBe(true);
}

afterEach(async () => {
  await userEvent.keyboard("{Escape}{Escape}");
  await browser.viewport(1440, 900);
});

describe("the layer's frame", () => {
  it("is a bottom sheet under 480px, a dialog to 639px and the panel from 640px", async () => {
    for (const [width, expected] of [
      [390, "sheet"],
      [480, "dialog"],
      [623, "dialog"],
      [640, "panel"],
      [768, "panel"],
      [1024, "panel"],
      [1440, "panel"]
    ] as const) {
      await browser.viewport(width, 900);
      const screen = await render(LayerDemo);
      const el = await openLayer();
      const box = rect(el);
      const corners = getComputedStyle(el);
      const label = `${width}px`;

      if (expected === "panel") {
        expect(el.dataset.layerFrame, label).toBe("panel");
        expect(box.right, label).toBeCloseTo(rect(trigger()).right, 0);
      } else {
        expect(el.dataset.layerFrame, label).toBe("modal");
        expect(box.width, label).toBeCloseTo(Math.min(width, 416), 0);
        expect(box.left + box.width / 2, label).toBeCloseTo(width / 2, 0);
        expect(box.height, label).toBeLessThanOrEqual(900 * 0.85 + 1);
        expect(parseFloat(corners.borderTopLeftRadius), label).toBeGreaterThan(0);
      }
      if (expected === "sheet") {
        expect(box.bottom, label).toBeCloseTo(900, 0);
        expect(parseFloat(corners.borderBottomLeftRadius), label).toBe(0);
      }
      if (expected === "dialog") {
        expect(box.top + box.height / 2, label).toBeCloseTo(450, 0);
        expect(parseFloat(corners.borderBottomLeftRadius), label).toBeGreaterThan(0);
      }
      await userEvent.keyboard("{Escape}");
      screen.unmount();
    }
  });
});

describe("a step", () => {
  it("opens beside the panel at 1440, which keeps its 20rem", async () => {
    await render(LayerDemo);
    const before = rect(await openLayer());
    expect(before.width).toBe(320);

    await openUpdated();
    await settled(picker());
    expect(title()).toBe("Filters");
    expect(rect(picker()!).right).toBeLessThanOrEqual(before.left - 12 + 1);
    expect(rect(panel()!)).toEqual(before);
  });

  it("keeps the picker 8px off the window's edge around the room line", async () => {
    // the demo's button ends 12px in. At 915px a 20rem panel leaves 583px: a
    // 568px picker would sit 3px off the edge, so the step opens inside; at
    // 940px it leaves 608px and the picker fits beside it
    for (const width of [915, 940]) {
      await browser.viewport(width, 900);
      const screen = await render(LayerDemo);
      await openLayer();
      await openUpdated();
      if (width === 915) {
        expect(picker(), `${width}px`).toBeNull();
        expect(title()).toBe("Updated");
      } else {
        expect(rect(await settled(picker())).left, `${width}px`).toBeGreaterThanOrEqual(8);
      }
      await userEvent.keyboard("{Escape}{Escape}");
      screen.unmount();
    }
  });

  it("opens inside the panel at 768, which opens at 22rem and keeps its edges", async () => {
    await browser.viewport(768, 1024);
    await render(LayerDemo);
    const before = rect(await openLayer());
    expect(before.width).toBe(352);

    await openUpdated();
    await expect.poll(picker).toBeNull();
    expect(title()).toBe("Updated");
    const { left, right, top } = rect(panel()!);
    expect({ left, right, top }).toEqual({
      left: before.left,
      right: before.right,
      top: before.top
    });

    [...panel()!.querySelectorAll<HTMLElement>("button")]
      .find((b) => b.textContent?.includes("Custom range"))!
      .click();
    await expect.poll(title).toBe("Updated: custom range");
    expect(rect(panel()!).left).toBe(before.left);
    expect(rect(panel()!).right).toBe(before.right);
  });
});

describe("a handover", () => {
  it("across 640px keeps a half-picked range and applies nothing", async () => {
    const screen = await render(LayerDemo);
    await openLayer();
    await openUpdated();
    await pickStart();

    await browser.viewport(390, 844);
    await handover();
    await expect.poll(modal).not.toBeNull();
    await expect.poll(picker).toBeNull();
    expect(title()).toBe("Updated: custom range");
    expect(halfPicked()).toBe(true);

    await browser.viewport(1440, 900);
    await handover();
    await expect.poll(picker).not.toBeNull();
    await expect.poll(modal).toBeNull();
    expect(halfPicked()).toBe(true);

    await expect.element(screen.getByText("12 of 12 divisions")).toBeInTheDocument();
    expect(trigger().textContent?.trim()).toBe("Filter");
  });

  it("across the room line keeps a half-picked range and applies nothing", async () => {
    const screen = await render(LayerDemo);
    await openLayer();
    await openUpdated();
    await pickStart();

    await browser.viewport(768, 1024);
    await handover();
    await expect.poll(title).toBe("Updated: custom range");
    await expect.poll(picker).toBeNull();
    expect(panel()).not.toBeNull();
    expect(halfPicked()).toBe(true);

    await browser.viewport(1440, 900);
    await handover();
    await expect.poll(picker).not.toBeNull();
    expect(title()).toBe("Filters");
    expect(halfPicked()).toBe(true);

    await expect.element(screen.getByText("12 of 12 divisions")).toBeInTheDocument();
  });

  // a sheet still waiting when the window widens again must not open on the wide window
  it("back across 640px calls off a sheet still waiting to open", async () => {
    await render(LayerDemo);
    await openLayer();

    // hold the frames the steady wait checks on, so the sheet stays waiting, as on a slow device
    const held: FrameRequestCallback[] = [];
    const original = window.requestAnimationFrame;
    let holding = true;
    window.requestAnimationFrame = (fn) => (holding ? (held.push(fn), 0) : original(fn));
    try {
      await browser.viewport(390, 844);
      await handover(); // the panel hands over; the sheet waits for the page to settle
      expect(modal()).toBeNull();

      await browser.viewport(1440, 900);
      await handover(); // back across 640px before the sheet showed
    } finally {
      holding = false;
      window.requestAnimationFrame = original;
      for (const fn of held.splice(0)) fn(performance.now());
    }
    await wait(1300); // past the steady wait's 1s cap

    expect(modal()).toBeNull();
    expect(panel()).not.toBeNull();
  });

  it("waits until the window has stopped resizing", async () => {
    await render(LayerDemo);
    await openLayer();
    await browser.viewport(390, 844);
    await wait(100);
    await browser.viewport(1440, 900);
    await wait(100);
    await browser.viewport(390, 844);
    await wait(100);
    // still the panel 100ms after the last resize
    expect(panel()).not.toBeNull();
    await expect.poll(modal).toBeNull();
    await handover();
    await expect.poll(modal).not.toBeNull();
  });
});

describe("closing", () => {
  it("by Esc peels the picker, then closes and reopens at the top level", async () => {
    await render(LayerDemo);
    await openLayer();
    await openUpdated();
    await pickStart();

    await userEvent.keyboard("{Escape}");
    await expect.poll(picker).toBeNull();
    expect(panel()).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.poll(panel).toBeNull();

    await openLayer();
    expect(title()).toBe("Filters");
    await openUpdated();
    expect(halfPicked()).toBe(false);
  });

  it("by a click outside both reopens at the top level", async () => {
    const screen = await render(LayerDemo);
    await openLayer();
    await openUpdated();
    await expect.poll(picker).not.toBeNull();

    await screen.getByText("12 of 12 divisions").click();
    await expect.poll(panel).toBeNull();
    await expect.poll(picker).toBeNull();

    await openLayer();
    expect(title()).toBe("Filters");
    await expect.poll(picker).toBeNull();
  });

  it("by its button closes it, picker and all", async () => {
    await render(LayerDemo);
    await openLayer();
    await openUpdated();
    await expect.poll(picker).not.toBeNull();

    await userEvent.click(trigger());
    await expect.poll(panel).toBeNull();
    await expect.poll(picker).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("by × reopens at the top level", async () => {
    await browser.viewport(390, 844);
    await render(LayerDemo);
    await openLayer();
    await openUpdated();
    expect(title()).toBe("Updated");

    modal()!.querySelector<HTMLElement>("[aria-label=Close]")!.click();
    await expect.poll(modal).toBeNull();

    await openLayer();
    expect(title()).toBe("Filters");
  });
});

describe("the keyboard", () => {
  // Tab until `found` holds for the focused element, as a keyboard user would
  async function tabTo(found: (el: HTMLElement) => boolean) {
    for (let i = 0; i < 40; i++) {
      if (found(document.activeElement as HTMLElement))
        return document.activeElement as HTMLElement;
      await userEvent.keyboard("{Tab}");
    }
    throw new Error(`never reached; stuck on ${document.activeElement?.outerHTML.slice(0, 120)}`);
  }
  const text = (words: string) => (el: HTMLElement) => el.textContent?.includes(words) ?? false;
  function expectQuietTitle(words: string) {
    const focused = document.activeElement as HTMLElement;
    expect(focused.matches("[data-layer-title]")).toBe(true);
    expect(focused.textContent?.trim()).toBe(words);
    const style = getComputedStyle(focused);
    expect(style.outlineStyle === "none" || style.outlineWidth === "0px").toBe(true);
    expect(style.boxShadow).toBe("none");
  }

  it("reaches every step in the sheet, each title focused without a ring", async () => {
    await browser.viewport(390, 844);
    const screen = await render(LayerDemo);
    trigger().focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => document.activeElement?.matches("[data-layer-title]")).toBe(true);
    expectQuietTitle("Filters");

    await tabTo((el) => el.dataset.slot === "filter-date-row");
    await userEvent.keyboard("{Enter}");
    await expect.poll(title).toBe("Updated");
    await expect.poll(() => document.activeElement?.textContent?.trim()).toBe("Updated");
    expectQuietTitle("Updated");

    await tabTo(text("Custom range"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(title).toBe("Updated: custom range");
    await expect
      .poll(() => document.activeElement?.textContent?.trim())
      .toBe("Updated: custom range");
    expectQuietTitle("Updated: custom range");

    // the calendar opens on today, then a range of three days back to yesterday
    await tabTo((el) => el.matches("[data-range-calendar-day]"));
    expect(document.activeElement!.matches("[data-today]")).toBe(true);
    await userEvent.keyboard(
      "{ArrowLeft}{ArrowLeft}{ArrowLeft}{Enter}{ArrowRight}{ArrowRight}{Enter}"
    );
    await tabTo((el) => el.matches("[data-layer-action]"));
    expect(document.activeElement!.textContent!.trim()).toMatch(/^Apply .+ – .+$/);
    await userEvent.keyboard("{Enter}");

    await expect.poll(title).toBe("Filters");
    expect(trigger().textContent).toContain("1");
    await expect.element(screen.getByText(/^\d+ of 12 divisions$/)).toBeInTheDocument();
  });

  it("opens the picker beside the panel on today", async () => {
    await render(LayerDemo);
    trigger().focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => document.activeElement?.matches("[data-layer-title]")).toBe(true);
    expectQuietTitle("Filters");

    await tabTo((el) => el.dataset.slot === "filter-date-row");
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => document.activeElement?.matches("[data-layer-picker] [data-range-calendar-day]"))
      .toBe(true);
    expect(document.activeElement!.matches("[data-today]")).toBe(true);
  });
});

describe("accessibility", () => {
  it("has no axe violations in any frame or step", async () => {
    for (const width of [390, 623, 1440]) {
      await browser.viewport(width, 900);
      const screen = await render(LayerDemo);
      await openLayer();
      expect(await axeViolations(document.body), `${width}px`).toEqual([]);
      await openUpdated();
      await settled(picker() ?? layer());
      expect(await axeViolations(document.body), `${width}px, a step`).toEqual([]);
      await userEvent.keyboard("{Escape}{Escape}");
      screen.unmount();
    }
  });
});
