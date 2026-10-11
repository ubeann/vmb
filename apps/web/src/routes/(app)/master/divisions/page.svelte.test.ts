import { DivisionListQuerySchema, type Division } from "@vmb/types";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import type { PageData } from "./$types.js";

const mockPage = { url: new URL("http://localhost/master/divisions") };
vi.mock("$app/state", () => ({ page: mockPage, navigating: { to: null } }));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("svelte-sonner", () => ({ toast }));
const invalidateAll = vi.fn(async () => {});
const goto = vi.fn(async () => {});
vi.mock("$app/navigation", () => ({ goto, invalidateAll }));

// The form action's answer, as `use:enhance` would hand it to the page.
let deleteResult: { type: "success" | "failure"; status: number; data: Record<string, unknown> };
// The real `deserialize` decodes through the running app's transport, which an
// isolated render doesn't start, so action replies here carry plain JSON data.
vi.mock("$app/forms", () => ({
  deserialize: (text: string) => {
    const reply = JSON.parse(text);
    return { ...reply, data: JSON.parse(reply.data) };
  },
  enhance: (form: HTMLFormElement, submit: (input: unknown) => unknown) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const after = (await submit({ formData: new FormData(form) })) as (input: unknown) => unknown;
      await after({ result: deleteResult, update: async () => {} });
    });
    return { destroy() {} };
  }
}));

/** A SvelteKit action reply, as `fetch` returns it to `deserialize`. */
function actionReply(type: "success" | "failure", status: number, data: string) {
  return new Response(JSON.stringify({ type, status, data }), {
    headers: { "content-type": "application/json" }
  });
}

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");

const division: Division = {
  id: "d1000000-0000-4000-8000-000000000001",
  name: "Operations",
  code: "OPS",
  description: "Fleet and day-to-day operations",
  colorHex: "#2563EB",
  iconName: "heroicon-o-cog-6-tooth",
  isActive: true,
  createdAt: "2026-01-05T01:00:00.000Z",
  updatedAt: "2026-10-05T03:04:00.000Z",
  deletedAt: null
};

const inactive: Division = {
  ...division,
  id: "d1000000-0000-4000-8000-000000000002",
  name: "Retired",
  code: "RET",
  description: null,
  isActive: false
};

const ALL = [
  "master-divisions.view_any",
  "master-divisions.create",
  "master-divisions.update",
  "master-divisions.delete",
  "master-divisions.restore"
];

function props(
  url: string,
  overrides: {
    items?: Division[];
    total?: number;
    outOf?: number;
    permissions?: string[];
    failed?: boolean;
  } = {}
) {
  mockPage.url = new URL(url, "http://localhost");
  const items = overrides.items ?? [division, inactive];
  return {
    data: {
      user: null,
      division: null,
      permissions: overrides.permissions ?? ALL,
      sidebarOpen: true,
      query: DivisionListQuerySchema.parse(Object.fromEntries(mockPage.url.searchParams)),
      divisions: overrides.failed
        ? null
        : {
            items,
            total: overrides.total ?? items.length,
            page: 1,
            perPage: 25,
            views: { all: overrides.total ?? items.length, trash: 3 },
            facets: { status: { active: 1, inactive: 1 } }
          },
      trashCount: 3,
      outOf: overrides.outOf ?? null
    } as PageData
  };
}

afterEach(async () => {
  localStorage.clear();
  vi.restoreAllMocks();
  toast.success.mockReset();
  toast.error.mockReset();
  invalidateAll.mockClear();
  goto.mockReset();
  goto.mockImplementation(async () => {});
  await browser.viewport(414, 896);
});

describe("divisions list", () => {
  it("renders the toolbar, the tabs, sortable headers, status pills and the footer", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(
      Page,
      props("/master/divisions?search=ops&status=active", { total: 60 })
    );

    await expect
      .element(screen.getByRole("heading", { name: "Divisions", level: 1 }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("searchbox", { name: "Search divisions" }))
      .toHaveValue("ops");

    // the All · Trash tabs, each with its count, keep the search
    await expect
      .element(screen.getByRole("link", { name: /^All 60 divisions$/ }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(screen.getByRole("link", { name: /^Trash 3 deleted divisions$/ }))
      .toHaveAttribute("href", "/master/divisions?search=ops&status=active&trashed=only");

    // each filter is one removable chip
    await expect
      .element(screen.getByRole("link", { name: "Remove filter Status: Active" }))
      .toHaveAttribute("href", "/master/divisions?search=ops");

    // the default sort is by name, ascending, and the header says so
    await expect
      .element(screen.getByRole("columnheader", { name: /Name/ }))
      .toHaveAttribute("aria-sort", "ascending");
    await expect
      .element(screen.getByRole("link", { name: "Code, sort ascending" }))
      .toHaveAttribute("href", "/master/divisions?search=ops&status=active&sort=code&dir=asc");

    await expect
      .element(screen.getByRole("link", { name: "Operations" }))
      .toHaveAttribute("href", "/master/divisions/d1000000-0000-4000-8000-000000000001");
    await expect.element(screen.getByText("OPS")).toBeVisible();
    const table = screen.getByRole("table");
    // there is no Status column: only the inactive row carries a pill (ADR-0051 rule 7)
    await expect
      .element(table.getByRole("columnheader", { name: "Status" }))
      .not.toBeInTheDocument();
    await expect.element(table.getByText("Active", { exact: true })).not.toBeInTheDocument();
    await expect
      .element(table.getByText("Inactive", { exact: true }))
      .toHaveAttribute("data-tone", "neutral");

    await expect.element(screen.getByText("Showing 1–25 of 60")).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Page 3" })).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Next page" }))
      .toHaveAttribute("href", "/master/divisions?search=ops&status=active&page=2");

    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("fits utility columns to their content and truncates a long description (ADR-0050)", async () => {
    await browser.viewport(2400, 900);
    const text =
      "Accounts payable and receivable, payroll, tax filings, month-end close and board reporting";
    const screen = await render(
      Page,
      props("/master/divisions", { items: [{ ...division, description: text }] })
    );

    // the body is capped at 90rem and centred, so the header's action stays at its edge
    const body = screen
      .getByRole("heading", { name: "Divisions", level: 1 })
      .element()
      .closest("header")!.parentElement!;
    expect(body.getBoundingClientRect().width).toBe(1440);

    const cell = (name: RegExp) => screen.getByRole("columnheader", { name }).element();
    expect(cell(/^Code/).getBoundingClientRect().width).toBeLessThan(120);

    const description = screen.getByText(text).element();
    expect(description.getAttribute("title")).toBe(text);
    expect(description.getBoundingClientRect().width).toBeLessThanOrEqual(
      parseFloat(getComputedStyle(description).fontSize) * 48
    );
    expect(description.scrollWidth).toBeGreaterThan(description.clientWidth);
  });

  it("says what the page is in one line, with the action on the title row", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    const title = screen.getByRole("heading", { name: "Divisions", level: 1 }).element();
    const action = screen.getByRole("link", { name: "New division" }).element();
    const description = screen.getByText("Organisational units that group stock and budgets.");
    await expect.element(description).toBeVisible();
    expect(action.getBoundingClientRect().top).toBeLessThan(title.getBoundingClientRect().bottom);
    expect(description.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
      title.getBoundingClientRect().bottom
    );
  });

  it("puts the tabs, search, Filter and View on the card's top edge, and the chips under them", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(
      Page,
      props("/master/divisions?search=ops&status=active,inactive", { total: 2, outOf: 12 })
    );

    const card = screen
      .getByRole("heading", { name: "Divisions", level: 1 })
      .element()
      .closest("header")!.parentElement!.children[1]!;
    const within = (element: Element) => card.contains(element);
    expect(within(screen.getByRole("link", { name: /^All 2 divisions$/ }).element())).toBe(true);
    expect(within(screen.getByRole("searchbox").element())).toBe(true);
    expect(within(screen.getByRole("button", { name: /^Filter/ }).element())).toBe(true);
    expect(within(screen.getByRole("button", { name: "View" }).element())).toBe(true);

    // the search is a chip too, and so is a filter with several values
    await expect
      .element(screen.getByRole("link", { name: "Clear the search" }))
      .toHaveAttribute("href", "/master/divisions?status=active,inactive");
    await expect
      .element(screen.getByRole("link", { name: "Remove filter Status: Active, Inactive" }))
      .toHaveAttribute("href", "/master/divisions?search=ops");
    // Clear all comes after the last chip and clears the search with the filters
    await expect
      .element(screen.getByRole("link", { name: "Clear all" }))
      .toHaveAttribute("href", "/master/divisions");

    // "n of m divisions" is in the footer
    await expect.element(screen.getByText("2 of 12 divisions")).toBeVisible();
  });

  it("shows no chip strip and no Clear all while nothing is searched or filtered", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    await expect
      .element(screen.getByRole("list", { name: "Filters in use" }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByRole("link", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("opens the Filter panel from a chip, and a tick in it applies at once", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions?status=active"));

    await screen.getByRole("button", { name: "Status Active" }).click();
    const panel = screen.getByRole("dialog", { name: "Filters" });
    const active = panel.getByRole("checkbox", { name: /^Active/ });
    const inactive = panel.getByRole("checkbox", { name: /^Inactive/ });
    await expect.element(active).toBeChecked();
    await expect.element(inactive).not.toBeChecked();

    await inactive.click();
    expect(goto).toHaveBeenCalledWith(
      "/master/divisions?status=active,inactive",
      expect.objectContaining({ noScroll: true })
    );
    // the panel stays open for the next choice
    await expect.element(active).toBeVisible();
  });

  it("opens the Filter panel on a date filter from its chip", async () => {
    await browser.viewport(1440, 900);
    const screen = await render(Page, props("/master/divisions?updated=week"));

    await screen.getByRole("button", { name: "Updated Last 7 days" }).click();
    await expect
      .element(screen.getByRole("radio", { name: /^Last 7 days/ }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByRole("link", { name: "Remove filter Updated: Last 7 days" }))
      .toHaveAttribute("href", "/master/divisions");
  });

  it("is one Filter button at every width, the phone's a funnel with the count in its corner", async () => {
    const screen = await render(Page, props("/master/divisions?status=active"));

    // no chip strip on a phone: the button counts what is filtered and the panel lists it
    await expect
      .element(screen.getByRole("link", { name: "Remove filter Status: Active" }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: /^Filter 1 active$/ }).click();

    const sheet = screen.getByRole("dialog", { name: "Filters" });
    await expect.element(sheet.getByRole("checkbox", { name: /^Active/ })).toBeChecked();
    await expect.element(sheet.getByRole("button", { name: /^Show 2 divisions$/ })).toBeVisible();
  });

  it("marks the searched text in the name, code and description", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions?search=op"));

    const marked = [...screen.container.querySelectorAll("tbody mark")].map(
      (mark) => mark.textContent
    );
    // Operations (name, description "day-to-day operations") and OPS (code)
    expect(marked).toEqual(["Op", "OP", "op"]);
    expect(screen.container.querySelector("tbody a[href$='0001']")?.textContent).toBe("Operations");
  });

  it("offers each action only to a caller who holds its permission", async () => {
    const reader = await render(
      Page,
      props("/master/divisions", { permissions: ["master-divisions.view_any"] })
    );
    await expect
      .element(reader.getByRole("link", { name: "New division" }))
      .not.toBeInTheDocument();
    await expect
      .element(reader.getByRole("button", { name: /^Actions for / }))
      .not.toBeInTheDocument();
    await expect.element(reader.getByRole("link", { name: /^Edit / })).not.toBeInTheDocument();
    reader.unmount();

    const editor = await render(
      Page,
      props("/master/divisions", {
        permissions: ["master-divisions.view_any", "master-divisions.update"]
      })
    );
    await editor.getByRole("button", { name: "Actions for Operations" }).click();
    await expect.element(editor.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect.element(editor.getByRole("menuitem", { name: "Deactivate" })).toBeVisible();
    await expect.element(editor.getByRole("menuitem", { name: "Delete…" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    editor.unmount();

    const admin = await render(Page, props("/master/divisions"));
    await expect.element(admin.getByRole("link", { name: "New division" })).toBeVisible();
    await admin.getByRole("button", { name: "Actions for Operations" }).click();
    await expect.element(admin.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect.element(admin.getByRole("menuitem", { name: "Delete…" })).toBeVisible();
    await expect.element(admin.getByRole("menuitem", { name: "View" })).not.toBeInTheDocument();
  });

  it("gives a row with one action a button, not a menu of one (ADR-0051 rule 8)", async () => {
    const screen = await render(
      Page,
      props("/master/divisions", {
        permissions: ["master-divisions.view_any", "master-divisions.delete"]
      })
    );

    await expect
      .element(screen.getByRole("button", { name: /^Actions for / }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Delete Operations" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Delete Operations?" })).toBeVisible();
  });

  it("names the row menu's trigger and keeps it a button slot for the touch size", async () => {
    const screen = await render(Page, props("/master/divisions"));

    const trigger = screen.getByRole("button", { name: "Actions for Operations" });
    await expect.element(trigger).toHaveAttribute("data-slot", "button");
    await trigger.click();
    // each item carries an icon; the destructive one is the only one not muted
    const items = screen.getByRole("menuitem").elements();
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Edit",
      "Deactivate",
      "Delete…"
    ]);
    for (const item of items) expect(item.querySelector("svg")).not.toBeNull();
  });

  it("has no axe violations with an inactive row and a row menu open", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    // axe reads colours, which are blended until the menu's entrance animation has finished
    const menu = screen.getByRole("menu").element();
    await Promise.all(menu.getAnimations({ subtree: true }).map((animation) => animation.finished));
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("deactivates a Division through the API and offers an Undo that reactivates it", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => actionReply("success", 200, '{"ok":true}'));
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Deactivate" }).click();

    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Operations deactivated",
        expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) })
      )
    );
    expect(fetch).toHaveBeenCalledWith(
      "/master/divisions?/deactivate",
      expect.objectContaining({ method: "POST" })
    );
    expect((fetch.mock.calls[0]?.[1]?.body as FormData).get("id")).toBe(division.id);
    expect(invalidateAll).toHaveBeenCalledTimes(1);

    const [, options] = toast.success.mock.calls[0] as [string, { action: { onClick(): void } }];
    options.action.onClick();
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Operations activated", {
        duration: 10_000,
        action: undefined
      })
    );
    expect(fetch).toHaveBeenLastCalledWith(
      "/master/divisions?/activate",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("runs row actions in order, so a later click waits for the one in flight", async () => {
    let release: () => void = () => {};
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            release = () => done(actionReply("success", 200, '{"ok":true}'));
          })
      )
      .mockImplementation(async () => actionReply("success", 200, '{"ok":true}'));
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Deactivate" }).click();
    await screen.getByRole("button", { name: "Actions for Retired" }).click();
    await screen.getByRole("menuitem", { name: "Activate" }).click();

    expect(fetch).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      "/master/divisions?/deactivate",
      "/master/divisions?/activate"
    ]);
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));
  });

  it("offers Activate on an inactive row, and says so when the API refuses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      actionReply("failure", 403, '{"error":"You do not have permission to do that."}')
    );
    const screen = await render(Page, props("/master/divisions", { items: [inactive] }));

    await screen.getByRole("button", { name: "Actions for Retired" }).click();
    await expect
      .element(screen.getByRole("menuitem", { name: "Deactivate" }))
      .not.toBeInTheDocument();
    await screen.getByRole("menuitem", { name: "Activate" }).click();

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("You do not have permission to do that.")
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("opens the record on a click anywhere on the row, but not from its own controls", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    await expect
      .element(screen.getByRole("link", { name: "Operations" }))
      .toHaveAttribute("href", `/master/divisions/${division.id}`);

    await screen.getByText("OPS").click();
    expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}`);

    // a selection made elsewhere on the page does not swallow the click
    goto.mockClear();
    const heading = screen.getByRole("heading", { name: "Divisions", level: 1 }).element();
    getSelection()?.selectAllChildren(heading);
    await screen.getByText("OPS").click();
    getSelection()?.removeAllRanges();
    expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}`);

    // Cmd/Ctrl-click is the name link's, for a new tab: the row does not also navigate
    goto.mockClear();
    await userEvent.keyboard("{Meta>}");
    await screen.getByText("OPS").click({ modifiers: ["Meta"] });
    await userEvent.keyboard("{/Meta}");
    expect(goto).not.toHaveBeenCalled();

    goto.mockClear();
    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await userEvent.keyboard("{Escape}");
    expect(goto).not.toHaveBeenCalled();
  });

  it.each(["Filter", "View"])(
    "closes %s on a click outside without also opening the row beneath it",
    async (button) => {
      await browser.viewport(1440, 900);
      const screen = await render(Page, props("/master/divisions"));

      await screen.getByRole("button", { name: new RegExp(`^${button}`) }).click();
      await expect
        .element(document.querySelector<HTMLElement>('[data-layer-frame="panel"]'))
        .toBeVisible();

      // the click that closes the layer is only that
      await screen.getByText("OPS").click();
      await expect.poll(() => document.querySelector("[data-layer-frame]")).toBeNull();
      expect(goto).not.toHaveBeenCalled();

      // and the next one, with nothing open, opens the record as it always did
      await screen.getByText("OPS").click();
      expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}`);
    }
  );

  it.each(["Filter", "View"])(
    "closes %s on a touch tap on a row, and opens nothing",
    async (button) => {
      await browser.viewport(1024, 900);
      const screen = await render(Page, props("/master/divisions"));
      await screen.getByRole("button", { name: new RegExp(`^${button}`) }).click();
      await expect
        .element(document.querySelector<HTMLElement>('[data-layer-frame="panel"]'))
        .toBeVisible();

      // a finger: touch pointer events, then the click they end in
      const code = screen.getByText("OPS").element();
      const init = { bubbles: true, cancelable: true, composed: true, pointerType: "touch" };
      code.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...init,
          pointerId: 7,
          isPrimary: true,
          button: 0,
          buttons: 1
        })
      );
      code.dispatchEvent(
        new PointerEvent("pointerup", {
          ...init,
          pointerId: 7,
          isPrimary: true,
          button: 0,
          buttons: 0
        })
      );
      code.dispatchEvent(new MouseEvent("click", { ...init, button: 0, detail: 1 }));

      await expect.poll(() => document.querySelector("[data-layer-frame]")).toBeNull();
      expect(goto).not.toHaveBeenCalled();
    }
  );

  it("tints the current page in the pager instead of filling it", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions", { total: 60 }));

    const current = screen.getByRole("link", { name: "Page 1" }).element() as HTMLElement;
    expect(current.getAttribute("aria-current")).toBe("page");
    const solid = Object.assign(document.createElement("div"), { className: "bg-primary" });
    document.body.append(solid);
    const filled = getComputedStyle(solid).backgroundColor;
    solid.remove();
    const style = getComputedStyle(current);
    expect(style.backgroundColor).not.toBe(filled);
    // a quiet tint with a hairline ring, its text the page's own colour
    expect(style.boxShadow).not.toBe("none");
    expect(style.color).toBe(getComputedStyle(screen.container).color);
  });

  it("paints every cell of a hovered row, and of a row with its menu open, in the same frame", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    const row = (name: string) =>
      screen.getByRole("link", { name }).element().closest("tr") as HTMLTableRowElement;
    // what a reader sees behind each cell: its own colour (the pinned ones) or else the row's
    const colours = (tr: HTMLTableRowElement) =>
      [...tr.cells].map((cell) => {
        const own = getComputedStyle(cell).backgroundColor;
        return own === "rgba(0, 0, 0, 0)" ? getComputedStyle(tr).backgroundColor : own;
      });
    const resting = colours(row("Retired"));

    // a row painted by the row's own fade would still read the resting colour at this moment
    expect(getComputedStyle(row("Operations")).transitionDuration).toBe("0s");

    await screen.getByText("OPS").hover();
    const hovered = colours(row("Operations"));
    expect(new Set(hovered).size).toBe(1);
    expect(hovered[0]).not.toBe(resting[0]);

    // with the pointer gone from the row, the open menu alone holds the colour
    await userEvent.unhover(screen.getByText("OPS").element());
    expect(colours(row("Operations"))).toEqual(resting);
    const trigger = screen.getByRole("button", { name: "Actions for Operations" });
    await trigger.click();
    // the pointer on the menu, which sits outside the row
    await userEvent.hover(screen.getByRole("menuitem", { name: "Edit" }).element());
    const open = colours(row("Operations"));
    expect(open).toEqual(hovered);
  });

  it("gives a Trashed row a Restore button and restores through the API", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(actionReply("success", 200, '{"ok":true}'));
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(
      Page,
      props("/master/divisions?trashed=only", { items: [trashed] })
    );

    await expect
      .element(screen.getByRole("button", { name: /^Actions for / }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Restore Operations" }).click();

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Operations restored"));
    expect(fetch).toHaveBeenCalledWith(
      "/master/divisions?/restore",
      expect.objectContaining({ method: "POST" })
    );
    expect(invalidateAll).toHaveBeenCalled();
  });

  it("says why the Trash keeps everything, counts what it holds and offers no permanent delete", async () => {
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(
      Page,
      props("/master/divisions?trashed=only", { items: [trashed] })
    );

    await expect
      .element(
        screen.getByText(
          "Deleted divisions stay here for the audit trail. Restore one to use it again."
        )
      )
      .toBeVisible();
    await expect.element(screen.getByText("Showing 1–1 of 1 deleted division")).toBeVisible();
    await expect
      .element(screen.getByText(/delete(?:d)? permanently|purge/i))
      .not.toBeInTheDocument();

    expect(await axeViolations(document.body)).toEqual([]);

    // the live list says none of it
    screen.unmount();
    const live = await render(Page, props("/master/divisions"));
    await expect.element(live.getByText(/audit trail/)).not.toBeInTheDocument();
  });

  it("asks before deleting, and says the Division can come back from Trash", async () => {
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();

    const dialog = screen.getByRole("dialog", { name: "Delete Operations?" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText(/You can restore it from Trash\./)).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  it("moves a deleted Division to the Trash and offers to undo it from the toast", async () => {
    deleteResult = { type: "success", status: 200, data: { ok: true } };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(actionReply("success", 200, '{"ok":true}'));
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Operations moved to Trash",
        expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) })
      )
    );

    const [, options] = toast.success.mock.calls[0] as [string, { action: { onClick(): void } }];
    options.action.onClick();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Operations restored"));
    expect(fetch).toHaveBeenCalledWith(
      "/master/divisions?/restore",
      expect.objectContaining({ method: "POST" })
    );
    expect((fetch.mock.calls[0]?.[1]?.body as FormData).get("id")).toBe(division.id);
    expect(invalidateAll).toHaveBeenCalled();
  });

  it("shows the API's message when a restore finds its name taken", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      actionReply("failure", 409, '{"error":"A division with that name already exists."}')
    );
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(
      Page,
      props("/master/divisions?trashed=only", { items: [trashed] })
    );

    await screen.getByRole("button", { name: "Restore Operations" }).click();

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("A division with that name already exists.")
    );
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("shows the Trash tab and its Deleted column on a Trashed row", async () => {
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(
      Page,
      props("/master/divisions?trashed=only", { items: [trashed] })
    );

    await expect
      .element(screen.getByRole("link", { name: /^Trash 3 deleted divisions$/ }))
      .toHaveAttribute("aria-current", "page");
    await expect.element(screen.getByRole("columnheader", { name: "Deleted" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Restore Operations" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: /^Edit / })).not.toBeInTheDocument();
  });

  it("tells an empty list, a search with no match, an empty Trash and a failure apart", async () => {
    const none = await render(Page, props("/master/divisions", { items: [] }));
    await expect.element(none.getByRole("heading", { name: "No divisions yet" })).toBeVisible();
    none.unmount();

    const noMatch = await render(Page, props("/master/divisions?search=zzz", { items: [] }));
    await expect
      .element(noMatch.getByRole("heading", { name: "No divisions match" }))
      .toBeVisible();
    await expect
      .element(noMatch.getByRole("link", { name: "Clear search and filters" }))
      .toHaveAttribute("href", "/master/divisions");
    noMatch.unmount();

    const trash = await render(Page, props("/master/divisions?trashed=only", { items: [] }));
    await expect.element(trash.getByRole("heading", { name: "The Trash is empty" })).toBeVisible();
    await expect
      .element(
        trash.getByText("A division you delete waits here, and you can restore it at any time.")
      )
      .toBeVisible();
    trash.unmount();

    const failed = await render(Page, props("/master/divisions", { failed: true }));
    await expect
      .element(failed.getByText("Could not load divisions. Please try again."))
      .toBeVisible();
  });

  it("hides a column from the View panel and remembers it for the next visit", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    await expect.element(screen.getByRole("columnheader", { name: "Description" })).toBeVisible();
    await screen.getByRole("button", { name: "View" }).click();
    // the identity column is listed, but can't be hidden
    await expect.element(screen.getByText("Always shown")).toBeVisible();
    await expect.element(screen.getByRole("checkbox", { name: "Name" })).not.toBeInTheDocument();
    await screen.getByRole("checkbox", { name: "Description" }).click();
    await expect
      .element(screen.getByRole("columnheader", { name: "Description" }))
      .not.toBeInTheDocument();
    // the panel stays open, and a dot says something differs from the default
    await expect.element(screen.getByRole("checkbox", { name: "Code" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "View changed" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    screen.unmount();

    const again = await render(Page, props("/master/divisions"));
    await expect
      .element(again.getByRole("columnheader", { name: "Description" }))
      .not.toBeInTheDocument();
  });

  it("offers rows per page in View, applies one at once and keeps the panel open", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions?search=ops"));

    await screen.getByRole("button", { name: "View" }).click();
    const sizes = screen.getByRole("radiogroup", { name: "Rows per page" });
    await expect.element(sizes.getByRole("radio", { name: "25" })).toBeChecked();
    for (const size of ["10", "25", "50", "100"])
      await expect.element(sizes.getByRole("radio", { name: size })).toBeVisible();

    // the pick shows while its navigation is still on its way
    goto.mockImplementationOnce(() => new Promise(() => {}));
    await sizes.getByRole("radio", { name: "50" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions?search=ops&perPage=50", {
      noScroll: true,
      keepFocus: true
    });
    await expect.element(sizes.getByRole("radio", { name: "50" })).toBeChecked();

    // the default size leaves the URL
    await sizes.getByRole("radio", { name: "25" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions?search=ops", {
      noScroll: true,
      keepFocus: true
    });
  });

  it("keeps the sort in the headers on a wide card, and out of View", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "View" }).click();
    await expect.element(screen.getByRole("checkbox", { name: "Code" })).toBeVisible();
    await expect.element(screen.getByText("Sort by")).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("link", { name: "Code, sort ascending" }))
      .toHaveAttribute("href", "/master/divisions?sort=code&dir=asc");
  });

  it("sorts from View on a narrow card, each column starting in its natural order", async () => {
    const screen = await render(Page, props("/master/divisions"));
    // each pick shows while its navigation is on its way; the mock never lands one
    goto.mockImplementation(() => new Promise(() => {}));

    await screen.getByRole("button", { name: "View" }).click();
    // the columns give way to the sort once rows fold (ADR-0051 rule 11)
    await expect.element(screen.getByRole("checkbox", { name: "Code" })).not.toBeInTheDocument();
    const by = screen.getByRole("radiogroup", { name: "Sort by" });
    await expect.element(by.getByRole("radio", { name: "Name" })).toBeChecked();
    const order = screen.getByRole("radiogroup", { name: "Order" });
    await expect.element(order.getByRole("radio", { name: "A to Z" })).toBeChecked();

    await by.getByRole("radio", { name: "Last updated" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions?sort=updatedAt&dir=desc", {
      noScroll: true,
      keepFocus: true
    });
    // the words for the direction follow the column
    await expect.element(order.getByRole("radio", { name: "Newest first" })).toBeChecked();
    await order.getByRole("radio", { name: "Oldest first" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions?sort=updatedAt", {
      noScroll: true,
      keepFocus: true
    });

    await by.getByRole("radio", { name: "Name" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions", {
      noScroll: true,
      keepFocus: true
    });
    await order.getByRole("radio", { name: "Z to A" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions?dir=desc", {
      noScroll: true,
      keepFocus: true
    });
  });

  it("keeps a pick that is still loading when the next one comes, and Reset undoes it", async () => {
    const screen = await render(Page, props("/master/divisions"));
    goto.mockImplementation(() => new Promise(() => {}));

    await screen.getByRole("button", { name: "View" }).click();
    await screen
      .getByRole("radiogroup", { name: "Rows per page" })
      .getByRole("radio", { name: "50" })
      .click();
    await screen
      .getByRole("radiogroup", { name: "Sort by" })
      .getByRole("radio", { name: "Code" })
      .click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions?perPage=50&sort=code", {
      noScroll: true,
      keepFocus: true
    });

    // the URL hasn't caught up, but the dot and Reset already know
    await screen.getByRole("button", { name: "Reset" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions", {
      noScroll: true,
      keepFocus: true
    });
  });

  it("shows what the list has again when a pick's navigation ends without landing", async () => {
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "View" }).click();
    const sizes = screen.getByRole("radiogroup", { name: "Rows per page" });
    await sizes.getByRole("radio", { name: "50" }).click();
    await expect.element(sizes.getByRole("radio", { name: "25" })).toBeChecked();
  });

  it("sorts the Trash by when a division was deleted", async () => {
    const screen = await render(Page, props("/master/divisions?trashed=only&sort=updatedAt"));

    await screen.getByRole("button", { name: "View changed" }).click();
    await expect
      .element(
        screen
          .getByRole("radiogroup", { name: "Sort by" })
          .getByRole("radio", { name: "Date deleted" })
      )
      .toBeChecked();
    await expect
      .element(screen.getByRole("radio", { name: "Last updated" }))
      .not.toBeInTheDocument();
  });

  it("puts a dot on View when anything differs, and Reset restores all", async () => {
    const screen = await render(Page, props("/master/divisions?sort=code&dir=desc&perPage=50"));
    goto.mockImplementation(() => new Promise(() => {}));

    await expect
      .element(screen.getByRole("button", { name: "View", exact: true }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "View changed" }).click();
    await screen.getByRole("button", { name: "Reset" }).click();
    expect(goto).toHaveBeenLastCalledWith("/master/divisions", {
      noScroll: true,
      keepFocus: true
    });
    await expect
      .element(
        screen.getByRole("radiogroup", { name: "Sort by" }).getByRole("radio", { name: "Name" })
      )
      .toBeChecked();
    await expect
      .element(
        screen.getByRole("radiogroup", { name: "Rows per page" }).getByRole("radio", { name: "25" })
      )
      .toBeChecked();
  });

  it("has no dot and no Reset while View holds the defaults", async () => {
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "View", exact: true }).click();
    await expect.element(screen.getByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("ends View with Done in the sheet, which closes it without applying anything", async () => {
    await browser.viewport(390, 844);
    const screen = await render(Page, props("/master/divisions", { total: 12 }));

    await screen.getByRole("button", { name: "View" }).click();
    await screen.getByRole("radio", { name: "10" }).click();
    goto.mockClear();
    // not "Show 12 divisions": nothing in View changes the count, and at 10 rows a page 10 are listed
    await expect.element(screen.getByRole("button", { name: /^Show / })).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Done" }).click();

    // it applies nothing: the picks already did
    expect(goto).not.toHaveBeenCalled();
    await expect.element(screen.getByRole("dialog", { name: "View" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "View" })).toHaveFocus();
  });

  it("has no footer on the panel: View ends at Rows per page, and Esc closes it", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions", { total: 12 }));

    await screen.getByRole("button", { name: "View" }).click();
    await expect.element(screen.getByRole("dialog", { name: "View" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Done" })).not.toBeInTheDocument();
    const panel = document.querySelector<HTMLElement>('[data-layer-frame="panel"]')!;
    expect(
      [...panel.querySelectorAll<HTMLElement>("[data-layer-action]")].filter(
        (el) => el.getClientRects().length > 0
      )
    ).toEqual([]);

    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByRole("dialog", { name: "View" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "View" })).toHaveFocus();
  });

  it("says Done in the Trash and when the list failed to load, too", async () => {
    await browser.viewport(390, 844);
    const trash = await render(Page, props("/master/divisions?trashed=only", { total: 3 }));
    await trash.getByRole("button", { name: "View" }).click();
    await expect.element(trash.getByRole("button", { name: "Done" })).toBeVisible();
    trash.unmount();

    const failed = await render(Page, props("/master/divisions", { failed: true }));
    await failed.getByRole("button", { name: "View" }).click();
    await expect.element(failed.getByRole("button", { name: "Done" })).toBeVisible();
  });

  it("closes the sheet and the dialog from the same action, and the sheet doesn't scroll at 375 x 667", async () => {
    await browser.viewport(375, 667);
    const sheet = await render(Page, props("/master/divisions", { total: 12 }));
    await sheet.getByRole("button", { name: "View" }).click();

    const frame = document.querySelector<HTMLElement>('[data-layer-frame="modal"]')!;
    const body = frame.querySelector<HTMLElement>(".overflow-y-auto")!;
    await expect.poll(() => frame.getAnimations({ subtree: true }).length).toBe(0);
    // the sort steps are the tallest content View has; the action sits under all of it
    await expect.element(sheet.getByRole("radiogroup", { name: "Sort by" })).toBeVisible();
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight);
    const action = sheet.getByRole("button", { name: "Done" }).element();
    expect(action.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight);

    await sheet.getByRole("button", { name: "Done" }).click();
    await expect.element(sheet.getByRole("dialog", { name: "View" })).not.toBeInTheDocument();
    sheet.unmount();

    await browser.viewport(520, 800);
    const dialog = await render(Page, props("/master/divisions", { total: 12 }));
    await dialog.getByRole("button", { name: "View" }).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect.element(dialog.getByRole("dialog", { name: "View" })).not.toBeInTheDocument();
  });

  it("has no axe violations with the View panel open", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));
    await screen.getByRole("button", { name: "View" }).click();
    await expect.element(screen.getByRole("checkbox", { name: "Code" })).toBeVisible();
    // axe reads the colours it sees: a panel still fading in measures as low contrast
    const panel = document.querySelector<HTMLElement>('[data-layer-frame="panel"]')!;
    await expect.poll(() => panel.getAnimations({ subtree: true }).length).toBe(0);

    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("dresses the panel's rows itself, and adds no landmark of its own", async () => {
    const screen = await render(Page, props("/master/divisions"));
    await screen.getByRole("button", { name: "View" }).click();

    // the legacy `button:not([data-slot])` rule would give each row a border and a fill
    for (const row of [
      screen.getByRole("radio", { name: "Code" }).element(),
      screen.getByRole("radio", { name: "50" }).element()
    ]) {
      expect(getComputedStyle(row).borderTopWidth).toBe("0px");
    }
    // a <header> or <footer> in the portalled layer would read as a second banner
    const { violations } = await axe.run(document.body, {
      runOnly: { type: "rule", values: ["landmark-no-duplicate-banner", "landmark-unique"] }
    });
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });

  it("hides the paging when every row fits, and keeps the count", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions", { total: 2 }));

    await expect.element(screen.getByText("2 divisions")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("status").getByText("Showing 1–2 of 2")).toBeVisible();
    await expect.element(screen.getByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
    // the page size moved into View
    await expect.element(screen.getByText("Rows per page")).not.toBeInTheDocument();
  });

  it("numbers the pages from 640px", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions", { total: 239 }));

    const pages = screen.getByRole("navigation", { name: "Pages" });
    await expect.element(pages.getByRole("link", { name: "Page 10" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Previous" })).not.toBeInTheDocument();
  });

  it("pages with Previous and Next under 640px, the count centred above", async () => {
    await browser.viewport(414, 896);
    const screen = await render(Page, props("/master/divisions?page=1", { total: 239 }));

    await expect.element(screen.getByText("Showing 1–25 of 239")).toBeVisible();
    await expect.element(screen.getByText("Page 1 of 10")).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Next" }))
      .toHaveAttribute("href", "/master/divisions?page=2");
    // the first page has nothing before it, and the button keeps its width
    const previous = screen.getByRole("link", { name: "Previous" });
    await expect.element(previous).toHaveAttribute("aria-disabled", "true");
    await expect.element(previous).not.toHaveAttribute("href");
    expect(previous.element().getBoundingClientRect().width).toBe(
      screen.getByRole("link", { name: "Next" }).element().getBoundingClientRect().width
    );
    await expect.element(screen.getByRole("link", { name: "Page 3" })).not.toBeInTheDocument();
  });
});
