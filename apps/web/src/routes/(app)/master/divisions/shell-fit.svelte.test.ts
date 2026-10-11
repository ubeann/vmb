import { DivisionListQuerySchema, type Division } from "@vmb/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; every width rule is in it.
import "../../../../app.css";

import type { PageData } from "./$types.js";

// The list inside the real shell, so the card has the sidebar's share of the screen:
// ADR-0051 rule 11 reads the card, not the window.
const mockPage = {
  url: new URL("http://localhost/master/divisions"),
  data: {} as Record<string, unknown>
};
vi.mock("$app/paths", () => ({
  resolve: (path: string, params: Record<string, string> = {}) =>
    Object.entries(params).reduce(
      (out, [key, value]) => out.replace(`[${key}]`, value),
      path.replace("/(app)", "")
    )
}));
vi.mock("$app/state", () => ({ page: mockPage, navigating: { to: null } }));
const goto = vi.fn(async () => {});
vi.mock("$app/navigation", () => ({
  goto,
  invalidateAll: vi.fn(async () => {}),
  afterNavigate: () => {}
}));
vi.mock("$app/forms", () => ({ deserialize: () => ({}), enhance: () => ({ destroy() {} }) }));
vi.mock("svelte-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { render } = await import("vitest-browser-svelte");
const { default: Fixture } = await import("./shell-fixture.svelte");

const long: Division = {
  id: "d1000000-0000-4000-8000-000000000001",
  name: "Domestic and international freight forwarding and customs brokerage division",
  code: "FFC",
  description:
    "Accounts payable and receivable, payroll, tax filings, month-end close, board reporting and audit support",
  colorHex: "#2563EB",
  iconName: "heroicon-o-cog-6-tooth",
  isActive: true,
  createdAt: "2026-01-05T01:00:00.000Z",
  updatedAt: "2026-10-05T03:04:00.000Z",
  deletedAt: null
};
const items: Division[] = [
  long,
  { ...long, id: "d1000000-0000-4000-8000-000000000002", code: "RET", isActive: false }
];

const props = (sidebarOpen: boolean, sidebarSaved: boolean) => {
  mockPage.url = new URL("http://localhost/master/divisions");
  return {
    sidebarOpen,
    sidebarSaved,
    data: {
      user: null,
      division: null,
      permissions: ["master-divisions.view_any", "master-divisions.update"],
      sidebarOpen,
      query: DivisionListQuerySchema.parse({}),
      divisions: {
        items,
        total: items.length,
        page: 1,
        perPage: 25,
        views: { all: items.length, trash: 0 },
        facets: { status: { active: 1, inactive: 1 } }
      },
      trashCount: 0,
      outOf: null
    } as unknown as PageData
  };
};

afterEach(() => {
  goto.mockClear();
  document.cookie = "sidebar_state=; path=/; max-age=0";
});

const widthOf = (screen: { container: Element }, selector: string) =>
  screen.container.querySelector(selector)!.getBoundingClientRect().width;

describe("the Divisions list in the shell", () => {
  it("has no sideways scroll at 1024, 768, 623 or 390, with the sidebar open and collapsed", async () => {
    for (const width of [1024, 768, 623, 390]) {
      for (const open of [true, false]) {
        await browser.viewport(width, 900);
        const screen = await render(Fixture, props(open, true));
        const label = `${width}px, sidebar ${open ? "open" : "collapsed"}`;

        const frame = screen.container.querySelector("[data-slot=table-container]")!;
        expect(frame.scrollWidth, `${label}: the table`).toBeLessThanOrEqual(frame.clientWidth);
        const panel = document.querySelector("#main-content")!;
        expect(panel.scrollWidth, `${label}: the panel`).toBeLessThanOrEqual(panel.clientWidth);
        expect(document.documentElement.scrollWidth, `${label}: the page`).toBeLessThanOrEqual(
          document.documentElement.clientWidth
        );
        await screen.unmount();
      }
    }
  });

  it("has no sideways scroll on the default tablet rail either, at 768 and 623", async () => {
    for (const width of [768, 623]) {
      await browser.viewport(width, 900);
      const screen = await render(Fixture, props(true, false));
      // under 768px the sidebar is a sheet, so the rail only exists at 768
      if (width === 768) {
        await expect
          .poll(() =>
            document.querySelector("[data-slot='sidebar'][data-state]")?.getAttribute("data-state")
          )
          .toBe("collapsed");
      }
      const frame = screen.container.querySelector("[data-slot=table-container]")!;
      expect(frame.scrollWidth, `${width}px`).toBeLessThanOrEqual(frame.clientWidth);
      expect(document.documentElement.scrollWidth, `${width}px`).toBeLessThanOrEqual(
        document.documentElement.clientWidth
      );
      await screen.unmount();
    }
  });

  it.each(["Filter", "View"])(
    "a click on a folded row's second line closes %s and only that; the next one opens the record",
    async (button) => {
      await browser.viewport(768, 900);
      const screen = await render(Fixture, props(true, true));
      const second = [...screen.container.querySelectorAll("tbody td:first-child p")].find((line) =>
        line.checkVisibility()
      )!;
      expect(second, "the card is folded here").toBeTruthy();

      await screen.getByRole("button", { name: new RegExp(`^${button}`) }).click();
      await expect.poll(() => document.querySelector("[data-layer-frame]")).not.toBeNull();
      // a finger on the row beneath the layer: touch pointer events, then the click they end in
      const init = { bubbles: true, cancelable: true, composed: true, pointerType: "touch" };
      const down = { ...init, pointerId: 7, isPrimary: true, button: 0, buttons: 1 };
      second.dispatchEvent(new PointerEvent("pointerdown", down));
      second.dispatchEvent(new PointerEvent("pointerup", { ...down, buttons: 0 }));
      second.dispatchEvent(new MouseEvent("click", { ...init, button: 0, detail: 1 }));
      await expect.poll(() => document.querySelector("[data-layer-frame]")).toBeNull();
      expect(goto).not.toHaveBeenCalled();

      await userEvent.click(second);
      expect(goto).toHaveBeenCalledWith(`/master/divisions/${long.id}`);
    }
  );

  it("gives a 768px tablet a real table: the rail by default makes the card about 656px", async () => {
    await browser.viewport(768, 900);
    const screen = await render(Fixture, props(true, false));

    await expect
      .poll(() =>
        document.querySelector("[data-slot='sidebar'][data-state]")?.getAttribute("data-state")
      )
      .toBe("collapsed");
    await expect.poll(() => widthOf(screen, "[data-slot=table-container]")).toBeGreaterThan(640);
    await expect.element(screen.getByRole("columnheader", { name: /Updated/ })).toBeVisible();
  });

  it("folds the same list to two lines at 768px once the user opens the sidebar: a card of about 456px", async () => {
    await browser.viewport(768, 900);
    const screen = await render(Fixture, props(true, true));

    const card = widthOf(screen, "[data-slot=table-container]");
    expect(card).toBeGreaterThan(440);
    expect(card).toBeLessThan(512);
    expect(screen.container.querySelector("thead")!.checkVisibility()).toBe(false);
  });
});
