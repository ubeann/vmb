import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the frames and axe's colours need it.
import "../../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

const mockPage = { url: new URL("http://localhost/master/divisions") };
const goto = vi.fn(async () => {});
vi.mock("$app/state", () => ({ page: mockPage }));
vi.mock("$app/navigation", () => ({ goto }));

const { render } = await import("vitest-browser-svelte");
const { default: ListToolbar } = await import("./ListToolbar.svelte");
const { default: CalendarClockIcon } = await import("@lucide/svelte/icons/calendar-clock");
const { default: CalendarPlusIcon } = await import("@lucide/svelte/icons/calendar-plus");
const { default: CircleDotIcon } = await import("@lucide/svelte/icons/circle-dot");

// The Filter panel (#365, ADR-0051 rule 4) as the Divisions list mounts it: Status with counts,
// Updated and Created as date rows, on the kit's layer. The frames themselves are the layer's
// own tests (design-system/layer.svelte.test.ts); these cover what the panel puts in them.

const FILTERS = [
  {
    key: "status",
    label: "Status",
    icon: CircleDotIcon,
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" }
    ]
  },
  { kind: "date", key: "updated", label: "Updated", icon: CalendarClockIcon },
  { kind: "date", key: "created", label: "Created", icon: CalendarPlusIcon }
] as const;

async function toolbar(search = "") {
  mockPage.url = new URL(`http://localhost/master/divisions${search}`);
  return render(ListToolbar, {
    base: "/master/divisions",
    viewsLabel: "Division views",
    countNouns: {
      all: { one: "division", many: "divisions" },
      trash: { one: "deleted division", many: "deleted divisions" }
    },
    views: { all: 12, trash: 1 },
    searchLabel: "Search divisions",
    searchPlaceholder: "Search name, code or description",
    searchShortPlaceholder: "Search divisions",
    filters: FILTERS,
    facets: { status: { active: 9, inactive: 3 } }
  });
}

const find = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T & HTMLElement>(selector);
const layer = () => find("[data-layer-frame]")!;
const picker = () => find("[data-layer-picker]");

// A fixed day, so a preset's dates and the days to pick are known: 15 January 2026, noon in WIB.
// Last 7 days is the 9th to the 15th, This month the 1st to the 15th.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-15T05:00:00Z"));
});

async function openPanel(screen: Awaited<ReturnType<typeof toolbar>>) {
  await screen.getByRole("button", { name: /^Filter/ }).click();
  await expect.poll(() => find("[data-layer-frame]")).not.toBeNull();
  await Promise.all(
    layer()
      .getAnimations({ subtree: true })
      .map((a) => a.finished)
  );
}
const row = (name: string) =>
  [...layer().querySelectorAll<HTMLElement>("[data-slot=filter-date-row]")].find((el) =>
    el.textContent!.trim().startsWith(name)
  )!;

// the calendar a step or the picker shows
const within = () => picker() ?? layer();
const calendar = () => within().querySelector<HTMLElement>("[data-range-calendar-root]");
const heading = () => within().querySelector("[data-range-calendar-header]")?.textContent?.trim();
const dayButton = (day: number) =>
  [
    ...within().querySelectorAll<HTMLElement>("[data-range-calendar-day]:not([data-outside-month])")
  ].find((el) => el.textContent!.trim() === String(day));
async function go(button: "prev" | "next", month: string) {
  within().querySelector<HTMLElement>(`[data-range-calendar-${button}-button]`)!.click();
  await expect.poll(heading).toBe(month);
}
// Picking the end of a range in another month than its start brings the calendar back to the
// start's month, so only a start (or an end in the month shown) can be checked in place.
async function pick(day: number, { inPlace = true } = {}) {
  await expect.poll(() => dayButton(day)).toBeTruthy();
  dayButton(day)!.click();
  if (inPlace) await expect.poll(() => dayButton(day)!.hasAttribute("data-selected")).toBe(true);
}

afterEach(async () => {
  await userEvent.keyboard("{Escape}{Escape}");
  vi.useRealTimers();
  goto.mockClear();
  await browser.viewport(1440, 900);
});

describe("the Status filter", () => {
  it("lists each value as a checkbox with the rows it would give", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    await expect.element(screen.getByRole("checkbox", { name: "Active 9" })).not.toBeChecked();
    await expect.element(screen.getByRole("checkbox", { name: "Inactive 3" })).not.toBeChecked();
  });

  it("draws an unchecked box with the 3:1 field edge on the cream fill, not the toolbar's fainter one", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    const box = getComputedStyle(
      screen.getByRole("checkbox", { name: /^Active/ }).element() as HTMLElement
    );
    // WCAG 1.4.11: an unchecked box has nothing but its edge (`--input`, 3:1 on paper and white)
    const probe = Object.assign(document.createElement("div"), {
      className: "border border-input"
    });
    document.body.append(probe);
    const edge = getComputedStyle(probe).borderTopColor;
    probe.remove();
    expect(box.borderTopColor).toBe(edge);
    expect(box.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("applies at once, keeps the panel open and builds several values into one parameter", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    await screen.getByRole("checkbox", { name: /^Inactive/ }).click();
    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?status=inactive",
      expect.objectContaining({ noScroll: true, keepFocus: true })
    );
    // a second tick before the first navigation lands (the URL has not moved) builds on it
    await screen.getByRole("checkbox", { name: /^Active/ }).click();
    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?status=active,inactive",
      expect.anything()
    );
    await expect.element(screen.getByRole("dialog", { name: "Filters" })).toBeVisible();
    // and ticking one off leaves the other
    await screen.getByRole("checkbox", { name: /^Inactive/ }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions?status=active", expect.anything());
  });

  it("counts what is in use on the button and in Reset, which keeps the search", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?search=ops&status=active&updated=week&page=2");

    await expect.element(screen.getByRole("button", { name: "Filter 2 in use" })).toBeVisible();
    await openPanel(screen);
    await screen.getByRole("button", { name: "Reset" }).click();
    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?search=ops",
      expect.objectContaining({ noScroll: true })
    );
  });

  it("names the view it is in: the Trash's rows are deleted divisions, and a count of one is singular", async () => {
    await browser.viewport(390, 844);
    const screen = await toolbar("?trashed=only");
    await openPanel(screen);

    await expect
      .element(screen.getByRole("button", { name: "Show 1 deleted division" }))
      .toBeVisible();
  });

  it("offers no Reset while nothing is filtered", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    await expect.element(screen.getByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });
});

describe("the action that only closes the layer", () => {
  // the layer's actions a person can see: a footer hidden on the panel takes no space
  const shown = () =>
    [...layer().querySelectorAll<HTMLElement>("[data-layer-action]")].filter(
      (el) => el.getClientRects().length > 0
    );

  it("is not on the panel: every pick applies at once and a click outside, Esc or the button closes it", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    expect(layer().dataset.layerFrame).toBe("panel");
    expect(shown().map((el) => el.textContent)).toEqual([]);
    await expect.element(screen.getByRole("button", { name: /^Show / })).not.toBeInTheDocument();
    // the panel ends at the last row, with no footer under it
    const last = [...layer().querySelectorAll<HTMLElement>("[data-slot=filter-date-row]")].at(-1)!;
    expect(
      layer().getBoundingClientRect().bottom - last.getBoundingClientRect().bottom
    ).toBeLessThan(16);

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => find("[data-layer-frame]")).toBeNull();
    await expect.element(screen.getByRole("button", { name: /^Filter/ })).toHaveFocus();
  });

  it.each([
    ["the sheet", 390],
    ["the dialog", 560]
  ])("is in %s, closes it and gives focus back to the Filter button", async (_name, width) => {
    await browser.viewport(width, 844);
    const screen = await toolbar();
    await openPanel(screen);

    expect(layer().dataset.layerFrame).toBe("modal");
    const action = screen.getByRole("button", { name: "Show 12 divisions" });
    await expect.element(action).toBeVisible();
    expect(await axeViolations(layer())).toEqual([]);
    await action.click();

    await expect.poll(() => find("[data-layer-frame]")).toBeNull();
    await expect.element(screen.getByRole("button", { name: /^Filter/ })).toHaveFocus();
  });

  it("leaves the range's Apply in every frame, because it applies something", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);
    row("Updated").click();
    await expect.poll(() => picker()).not.toBeNull();
    // beside the panel: Apply is there and the panel itself still has no close action
    await expect
      .element(screen.getByRole("button", { name: "Pick a start and an end" }))
      .toBeVisible();
    expect(shown()).toEqual([]);
    await userEvent.keyboard("{Escape}{Escape}");

    // inside the panel, at a width with no room beside it
    await browser.viewport(768, 900);
    await openPanel(screen);
    row("Updated").click();
    await screen.getByRole("button", { name: /^Custom range/ }).click();
    await expect
      .element(screen.getByRole("button", { name: "Pick a start and an end" }))
      .toBeVisible();
  });
});

// What docs/design/list-kit/parity.md pins for this layer (#409).
describe("the Filter layer's measures", () => {
  const size = (element: Element) => {
    const { width, height } = element.getBoundingClientRect();
    return [Math.round(width), Math.round(height)];
  };
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

  it("is 20rem wide where its picker fits beside it, 22rem where it doesn't, with 32px option rows and 36px date rows", async () => {
    await browser.viewport(1440, 900);
    const wide = await toolbar();
    await openPanel(wide);
    // offsetWidth, as the panel is still zooming in and a bounding box shrinks with it
    expect((layer() as HTMLElement).offsetWidth).toBe(20 * rem());
    const option = wide
      .getByRole("checkbox", { name: /^Active/ })
      .element()
      .closest("label")!;
    expect(size(option)[1]).toBe(32);
    expect(size(row("Updated"))[1]).toBe(36);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => find("[data-layer-frame]")).toBeNull();
    wide.unmount();

    await browser.viewport(768, 900);
    const narrow = await toolbar();
    await openPanel(narrow);
    expect((layer() as HTMLElement).offsetWidth).toBe(22 * rem());
  });

  it("makes the sheet's and dialog's rows 44px, as the prototype's phone sheet had them, and the date rows 56px plus their hairline", async () => {
    for (const width of [390, 560]) {
      await browser.viewport(width, 844);
      const modal = await toolbar();
      await openPanel(modal);
      const option = modal
        .getByRole("checkbox", { name: /^Active/ })
        .element()
        .closest("label")!;
      expect(size(option)[1]).toBe(44);
      // the prototype's 56px row (h-14) is padding and 44px button, plus the hairline under it here
      expect(size(row("Updated").parentElement!)[1]).toBe(57);
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => find("[data-layer-frame]")).toBeNull();
      modal.unmount();
    }
  });

  it("keeps Reset a link by the title on the panel, and moves it beside the main action in the sheet and dialog", async () => {
    await browser.viewport(1440, 900);
    const panel = await toolbar("?status=active");
    await openPanel(panel);
    const link = panel.getByRole("button", { name: "Reset" }).element();
    expect(link.closest("[data-layer-frame]")).toBe(layer());
    expect(link.getAttribute("data-slot")).toBe("layer-reset");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => find("[data-layer-frame]")).toBeNull();
    panel.unmount();

    for (const width of [390, 560]) {
      await browser.viewport(width, 844);
      const modal = await toolbar("?status=active&search=ops");
      await openPanel(modal);
      expect(layer().dataset.layerFrame).toBe("modal");
      const reset = modal.getByRole("button", { name: "Reset" });
      const show = modal.getByRole("button", { name: "Show 12 divisions" });
      // one Reset, in the footer with the action it sits beside, not up by the title
      expect(modal.getByRole("button", { name: "Reset" }).elements()).toHaveLength(1);
      expect(reset.element().parentElement).toBe(show.element().parentElement);
      expect(reset.element().getAttribute("data-slot")).toBe("button");
      expect(show.element().getBoundingClientRect().left).toBeGreaterThan(
        reset.element().getBoundingClientRect().right
      );
      await reset.click();
      expect(goto).toHaveBeenLastCalledWith(
        "/master/divisions?search=ops",
        expect.objectContaining({ noScroll: true })
      );
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => find("[data-layer-frame]")).toBeNull();
      modal.unmount();
    }
  });
});

describe("a date filter", () => {
  it("is a row showing its value, opening presets with their dates beside the panel", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?updated=week");
    await openPanel(screen);

    expect(row("Updated").textContent).toContain("Last 7 days");
    expect(row("Created").textContent).toContain("Any time");
    row("Created").click();
    await expect.poll(() => picker()).not.toBeNull();

    for (const [name, dates] of [
      ["Any time", ""],
      ["Today", "15 Jan"],
      ["Last 7 days", "9 – 15 Jan"],
      ["This month", "1 – 15 Jan"]
    ])
      await expect
        .element(screen.getByRole("radio", { name: `${name} ${dates}`.trim() }))
        .toBeVisible();
  });

  it("opens a picker no wider than the room the panel reserves for it, on a short screen too", async () => {
    for (const height of [900, 600]) {
      await browser.viewport(1440, height);
      const screen = await toolbar();
      await openPanel(screen);
      row("Updated").click();
      await expect.poll(() => picker()).not.toBeNull();
      await Promise.all(
        picker()!
          .getAnimations({ subtree: true })
          .map((a) => a.finished)
      );
      const { width } = picker()!.getBoundingClientRect();
      console.info(`picker beside the panel at ${height}px tall: ${width}px`);
      expect(width, `${height}px tall`).toBeLessThanOrEqual(576);
      expect(width, `${height}px tall`).toBeGreaterThan(540);
      await userEvent.keyboard("{Escape}{Escape}");
      screen.unmount();
    }
  });

  it("applies a preset at once and closes the picker, keeping the panel", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?status=active");
    await openPanel(screen);

    row("Updated").click();
    await expect.poll(() => picker()).not.toBeNull();
    await screen.getByRole("radio", { name: /^Last 7 days/ }).click();

    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?status=active&updated=week",
      expect.objectContaining({ noScroll: true })
    );
    await expect.poll(() => picker()).toBeNull();
    await expect.element(screen.getByRole("dialog", { name: "Filters" })).toBeVisible();
  });

  it("applies a custom range with 'Apply …', naming the days", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    row("Created").click();
    await expect.poll(() => picker()).not.toBeNull();
    await expect
      .element(screen.getByRole("button", { name: "Pick a start and an end" }))
      .toBeDisabled();
    await pick(5);
    await pick(8);

    const apply = screen.getByRole("button", { name: "Apply 5 – 8 Jan" });
    await expect.element(apply).toBeEnabled();
    await apply.click();

    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?created=2026-01-05..2026-01-08",
      expect.objectContaining({ noScroll: true })
    );
    await expect.poll(() => picker()).toBeNull();
  });

  it("keeps the years of a range that crosses New Year", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    row("Updated").click();
    await expect.poll(() => calendar()).not.toBeNull();
    await go("prev", "December 2025");
    await pick(29);
    await go("next", "January 2026");
    await pick(4, { inPlace: false });

    await expect
      .element(screen.getByRole("button", { name: "Apply 29 Dec 2025 – 4 Jan 2026" }))
      .toBeVisible();
  });

  it("saves a range equal to a preset as that preset", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    row("Updated").click();
    await expect.poll(() => calendar()).not.toBeNull();
    // the 9th to the 15th is Last 7 days
    await pick(9);
    await pick(15);
    await screen.getByRole("button", { name: "Apply 9 – 15 Jan" }).click();

    expect(goto).toHaveBeenLastCalledWith("/master/divisions?updated=week", expect.anything());
  });

  it("shows From and To, the lit half the end in view, and a tap jumps to its month", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    row("Updated").click();
    await expect.poll(() => calendar()).not.toBeNull();
    // the ends are open until days are picked
    await expect.element(screen.getByRole("button", { name: "From: Pick a start" })).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: "To: Pick an end" })).toBeDisabled();

    // a start last month and an end this month: longer than the month in view
    await go("prev", "December 2025");
    await pick(29);
    await go("next", "January 2026");
    await pick(4, { inPlace: false });

    // the calendar is back on the start's month, so the start is the lit half
    const from = screen.getByRole("button", { name: "From 29 Dec 2025, show its month" });
    const to = screen.getByRole("button", { name: "To 4 Jan 2026, show its month" });
    await expect.poll(heading).toBe("December 2025");
    await expect.element(from).toHaveAttribute("aria-current", "true");
    await expect.element(to).not.toHaveAttribute("aria-current");

    await to.click();
    await expect.poll(heading).toBe("January 2026");
    await expect.element(to).toHaveAttribute("aria-current", "true");
    await expect.element(from).not.toHaveAttribute("aria-current");

    await from.click();
    await expect.poll(heading).toBe("December 2025");
    await expect.element(from).toHaveAttribute("aria-current", "true");
  });

  it("opens from its chip at its picker, and drops with ×", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?created=2026-01-03..2026-01-05");

    const chip = screen.getByRole("button", { name: "Created 3 – 5 Jan" });
    await expect.element(chip).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Remove filter Created: 3 – 5 Jan" }))
      .toHaveAttribute("href", "/master/divisions");

    await chip.click();
    await expect.poll(() => picker()).not.toBeNull();
    // the calendar opens on the range in use
    await expect.poll(heading).toBe("January 2026");
    expect(dayButton(3)!.hasAttribute("data-selected")).toBe(true);
    expect(dayButton(5)!.hasAttribute("data-selected")).toBe(true);
  });

  it("lists a custom range in force under the presets beside the panel, marked current", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?created=2026-01-03..2026-01-05");
    await openPanel(screen);

    row("Created").click();
    await expect.poll(() => picker()).not.toBeNull();
    const custom = picker()!.querySelector<HTMLElement>("[aria-current=true]")!;
    expect(custom.textContent).toContain("Custom");
    expect(custom.textContent).toContain("3 – 5 Jan");
    // truncated in a narrow column, the full text on its title
    expect(custom.querySelector("[title]")!.getAttribute("title")).toBe("3 – 5 Jan 2026");
    // no preset claims to be the one applied
    for (const radio of picker()!.querySelectorAll("[role=radio]"))
      expect(radio.getAttribute("aria-checked")).toBe("false");
  });

  it("adds no Custom row while a preset or nothing is in force", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?created=week");
    await openPanel(screen);

    row("Created").click();
    await expect.poll(() => picker()).not.toBeNull();
    expect(picker()!.querySelector("[aria-current=true]")).toBeNull();
    await expect
      .element(screen.getByRole("radio", { name: /^Last 7 days/ }))
      .toHaveAttribute("aria-checked", "true");
  });

  it.each([
    ["inside the panel", 768],
    ["in the sheet", 390]
  ])(
    "says the same on the date step %s: Custom range, marked current, with the days",
    async (_name, width) => {
      await browser.viewport(width, 900);
      const screen = await toolbar("?created=2026-01-03..2026-01-05");
      await openPanel(screen);

      row("Created").click();
      const custom = screen.getByRole("button", { name: /^Custom range/ });
      await expect.element(custom).toHaveAttribute("aria-current", "true");
      expect(custom.element().textContent).toContain("3 – 5 Jan");
    }
  );

  it("keeps a date row lit and expanded while its picker is open beside the panel", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar();
    await openPanel(screen);

    expect(row("Created").getAttribute("aria-expanded")).toBe("false");
    const idle = getComputedStyle(row("Created")).backgroundColor;
    row("Created").click();
    await expect.poll(() => picker()).not.toBeNull();
    expect(row("Created").getAttribute("aria-expanded")).toBe("true");
    expect(row("Updated").getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => getComputedStyle(row("Created")).backgroundColor).not.toBe(idle);

    await screen.getByRole("radio", { name: /^Today/ }).click();
    await expect.poll(() => picker()).toBeNull();
    expect(row("Created").getAttribute("aria-expanded")).toBe("false");
  });

  it("shows a preset in force as its chip, with Updated and Created each their own", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?updated=month&created=today");

    await expect.element(screen.getByRole("button", { name: "Updated This month" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Created Today" })).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Clear all" }))
      .toHaveAttribute("href", "/master/divisions");
  });
});

describe("on a phone", () => {
  it("is a sheet whose steps never scroll on 375×667, the range step included", async () => {
    await browser.viewport(375, 667);
    const screen = await toolbar("?status=active");
    await openPanel(screen);
    expect(layer().dataset.layerFrame).toBe("modal");

    const fits = () => {
      const sheet = layer();
      expect(sheet.getBoundingClientRect().bottom).toBeLessThanOrEqual(667 + 1);
      for (const scroller of sheet.querySelectorAll<HTMLElement>(".overflow-y-auto"))
        expect(scroller.scrollHeight, "a step scrolls").toBeLessThanOrEqual(
          scroller.clientHeight + 1
        );
    };
    fits();

    row("Updated").click();
    await expect.element(screen.getByRole("radio", { name: /^Today/ })).toBeVisible();
    fits();
    await screen.getByRole("button", { name: /^Custom range/ }).click();
    await expect.poll(() => calendar()).not.toBeNull();
    await expect
      .element(screen.getByRole("button", { name: "Pick a start and an end" }))
      .toBeVisible();
    await pick(5);
    await pick(8);
    fits();
    expect(dayButton(5)!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

    // Apply goes back to the top level, with the filters in the URL
    await screen.getByRole("button", { name: "Apply 5 – 8 Jan" }).click();
    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?status=active&updated=2026-01-05..2026-01-08",
      expect.anything()
    );
    await expect.element(screen.getByRole("button", { name: "Show 12 divisions" })).toBeVisible();
  });
});

describe("accessibility", () => {
  it("has no axe violations at the top level or in the picker", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?status=active&updated=week");
    await openPanel(screen);
    expect(await axeViolations(layer())).toEqual([]);

    row("Created").click();
    await expect.poll(() => picker()).not.toBeNull();
    await pick(5);
    await pick(8);
    expect(await axeViolations(picker()!)).toEqual([]);
  });

  it("has no axe violations with the picker open on a custom range", async () => {
    await browser.viewport(1440, 900);
    const screen = await toolbar("?created=2026-01-03..2026-01-05");
    await openPanel(screen);
    row("Created").click();
    await expect.poll(() => picker()).not.toBeNull();
    await Promise.all(
      picker()!
        .getAnimations({ subtree: true })
        .map((a) => a.finished)
    );
    expect(await axeViolations(picker()!)).toEqual([]);
    expect(await axeViolations(layer())).toEqual([]);
  });

  it("has no axe violations in the sheet's range step", async () => {
    await browser.viewport(375, 667);
    const screen = await toolbar("?status=active&updated=week");
    await openPanel(screen);
    row("Created").click();
    await screen.getByRole("button", { name: /^Custom range/ }).click();
    await expect.poll(() => calendar()).not.toBeNull();
    await pick(5);
    await pick(8);
    expect(await axeViolations(layer())).toEqual([]);
  });
});
