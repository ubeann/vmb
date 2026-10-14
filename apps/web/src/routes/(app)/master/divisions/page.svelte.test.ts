import { DivisionListQuerySchema, type Division } from "@vmb/types";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import { shortcuts } from "$lib/components/shortcuts.svelte.js";
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
    await expect.element(screen.getByRole("cell", { name: "OPS" })).toBeVisible();
    const table = screen.getByRole("table");
    // there is no Status column: only the inactive row carries a pill (ADR-0051 rule 7)
    await expect
      .element(table.getByRole("columnheader", { name: "Status" }))
      .not.toBeInTheDocument();
    await expect.element(table.getByText("Active", { exact: true })).not.toBeInTheDocument();
    await expect
      .element(table.getByText("Inactive", { exact: true }).first())
      .toHaveAttribute("data-tone", "neutral");

    await expect.element(screen.getByText("Showing 1–25 of 60")).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Page 3" })).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Next page" }))
      .toHaveAttribute("href", "/master/divisions?search=ops&status=active&page=2");

    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("fits utility columns to their content and gives free text the spare width (ADR-0050)", async () => {
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

    // free text is no longer capped at 48ch: it fills what the other columns leave
    const description = screen.getByRole("cell", { name: text }).element().querySelector("span")!;
    expect(description.getAttribute("title")).toBe(text);
    expect(description.getBoundingClientRect().width).toBeGreaterThan(
      parseFloat(getComputedStyle(description).fontSize) * 48
    );
    expect(description.scrollWidth).toBe(description.clientWidth);
  });

  it("truncates free text to the card, down to 16ch, without a sideways scroll", async () => {
    const text =
      "Accounts payable and receivable, payroll, tax filings, month-end close, board reporting, audit support and every other back-office duty the company has";
    const items = [{ ...division, description: text }];

    await browser.viewport(1024, 900);
    const screen = await render(Page, props("/master/divisions", { items }));
    const description = screen.getByRole("cell", { name: text }).element().querySelector("span")!;
    const table = screen.getByRole("table").element().parentElement!;
    expect(description.scrollWidth).toBeGreaterThan(description.clientWidth);
    expect(table.scrollWidth).toBeLessThanOrEqual(table.clientWidth);
    await screen.unmount();

    // the narrowest card that still shows the column: 42rem
    await browser.viewport(680, 900);
    const narrow = await render(Page, props("/master/divisions", { items }));
    const squeezed = narrow.getByRole("cell", { name: text }).element().querySelector("span")!;
    const ch = parseFloat(getComputedStyle(squeezed).fontSize) * 0.5;
    expect(squeezed.getBoundingClientRect().width).toBeGreaterThanOrEqual(ch * 16);
    const frame = narrow.getByRole("table").element().parentElement!;
    expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
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
    await screen.getByRole("button", { name: /^Filter 1 in use$/ }).click();

    const sheet = screen.getByRole("dialog", { name: "Filters" });
    await expect.element(sheet.getByRole("checkbox", { name: /^Active/ })).toBeChecked();
    await expect.element(sheet.getByRole("button", { name: /^Show 2 divisions$/ })).toBeVisible();
  });

  it("marks the searched text in the name, code and description", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions?search=op"));

    // the folded second lines repeat the code and description for narrow cards; they are hidden here
    const marked = [...screen.container.querySelectorAll("tbody mark")]
      .filter((mark) => mark.checkVisibility())
      .map((mark) => mark.textContent);
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
    // each item carries an icon and its key (Backspace is drawn as an icon, not as text)
    const items = screen.getByRole("menuitem").elements();
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "EditE",
      "DeactivateD",
      "Delete…"
    ]);
    for (const item of items) expect(item.querySelector("svg")).not.toBeNull();
  });

  it("ships with keyboard rows on (ADR-0052 rule 4): the mark, Enter, an action key, the sheet's sections and the hints in the row menu", async () => {
    const screen = await render(Page, props("/master/divisions"));
    const marked = () => document.querySelector("tr[data-marked]")?.textContent ?? "";

    await userEvent.keyboard("{ArrowDown}");
    expect(marked()).toContain("Operations");

    await userEvent.keyboard("{Enter}");
    expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}`);

    goto.mockClear();
    await userEvent.keyboard("e");
    expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}/edit`);

    expect(shortcuts.page.map((section) => section.title)).toEqual([
      "On the Divisions list",
      "On a row"
    ]);
    // the search's `/` and the rows' own list it once
    expect(
      shortcuts.page[0]!.rows.filter((row) => row.keys.includes("/")).map((row) => row.what)
    ).toEqual(["Search"]);

    await userEvent.keyboard("{Escape}");
    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    expect(
      document.querySelectorAll("[data-slot='dropdown-menu-shortcut']").length
    ).toBeGreaterThan(0);
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

    await screen.getByRole("cell", { name: "OPS" }).click();
    expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}`);

    // a selection made elsewhere on the page does not swallow the click
    goto.mockClear();
    const heading = screen.getByRole("heading", { name: "Divisions", level: 1 }).element();
    getSelection()?.selectAllChildren(heading);
    await screen.getByRole("cell", { name: "OPS" }).click();
    getSelection()?.removeAllRanges();
    expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}`);

    // Cmd/Ctrl-click is the name link's, for a new tab: the row does not also navigate
    goto.mockClear();
    await userEvent.keyboard("{Meta>}");
    await screen.getByRole("cell", { name: "OPS" }).click({ modifiers: ["Meta"] });
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
      await screen.getByRole("cell", { name: "OPS" }).click();
      await expect.poll(() => document.querySelector("[data-layer-frame]")).toBeNull();
      expect(goto).not.toHaveBeenCalled();

      // and the next one, with nothing open, opens the record as it always did
      await screen.getByRole("cell", { name: "OPS" }).click();
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
      const code = screen.getByRole("cell", { name: "OPS" }).element();
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

    await screen.getByRole("cell", { name: "OPS" }).hover();
    const hovered = colours(row("Operations"));
    expect(new Set(hovered).size).toBe(1);
    expect(hovered[0]).not.toBe(resting[0]);

    // with the pointer gone from the row, the open menu alone holds the colour
    await userEvent.unhover(screen.getByRole("cell", { name: "OPS" }).element());
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
    await expect.element(screen.getByText("1 deleted division")).toBeVisible();
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

  it("keeps the dialog open and says what to do when the Division still has roles", async () => {
    const message =
      "3 roles belong to this division. Move them to another division or delete them first.";
    deleteResult = {
      type: "failure",
      status: 409,
      data: { error: message, code: "DIVISION_IN_USE" }
    };
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    const dialog = screen.getByRole("dialog", { name: "Delete Operations?" });
    await dialog.getByRole("button", { name: "Delete" }).click();

    // the refusal is in the dialog, in words, with the way to the Roles list, and not a toast
    await expect.element(dialog.getByRole("alert")).toBeVisible();
    expect(dialog.getByRole("alert").element().textContent).toContain(message);
    await expect
      .element(dialog.getByRole("link", { name: "Go to Roles" }))
      .toHaveAttribute("href", "/master/roles");
    await expect.element(dialog).toBeVisible();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("clears an earlier refusal when the dialog is opened for another Division", async () => {
    deleteResult = {
      type: "failure",
      status: 409,
      data: { error: "1 role belongs to this division.", code: "DIVISION_IN_USE" }
    };
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen
      .getByRole("dialog", { name: "Delete Operations?" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect.element(screen.getByRole("alert")).toBeVisible();
    await screen.getByRole("button", { name: "Cancel" }).click();

    await screen.getByRole("button", { name: "Actions for Retired" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Delete Retired?" })).toBeVisible();
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
  });

  it("still toasts a delete that failed for another reason", async () => {
    deleteResult = { type: "failure", status: 500, data: { error: "Something went wrong." } };
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong."));
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
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
    await browser.viewport(1280, 900);
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(
      Page,
      props("/master/divisions?trashed=only", { items: [trashed] })
    );

    await expect
      .element(screen.getByRole("link", { name: /^Trash 3 deleted divisions$/ }))
      .toHaveAttribute("aria-current", "page");
    await expect.element(screen.getByRole("columnheader", { name: /^Deleted/ })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Restore Operations" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: /^Edit / })).not.toBeInTheDocument();
  });

  it("tells an empty list, a search with no match, an empty Trash and a failure apart", async () => {
    const none = await render(Page, props("/master/divisions", { items: [] }));
    await expect.element(none.getByRole("heading", { name: "No divisions yet" })).toBeVisible();
    // the glossary's wording for a Division, not a second definition of it
    await expect
      .element(none.getByText("Divisions group warehouse items and expense budgets."))
      .toBeVisible();
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

    await expect.element(screen.getByRole("status").getByText("2 divisions")).toBeVisible();
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

  // The card answers to its own width (ADR-0051 rule 11). These pages render alone, so the
  // card is as wide as the viewport; the app shell's sidebar is checked in `shell-fit` below.
  describe("answers to the card's width (ADR-0051 rule 11)", () => {
    const visible = (element: Element | null | undefined) => Boolean(element?.checkVisibility());
    const lines = (screen: { container: Element }, selector: string) =>
      [...screen.container.querySelectorAll<HTMLElement>(`tbody ${selector}`)].filter((line) =>
        visible(line)
      );
    const headers = (screen: { container: Element }) =>
      [...screen.container.querySelectorAll("thead th")].filter((th) => visible(th));

    it("keeps every column on a card of 42rem or more, with no second line", async () => {
      await browser.viewport(1280, 900);
      const screen = await render(Page, props("/master/divisions"));

      for (const name of ["Name", "Code", "Description", "Updated"]) {
        await expect
          .element(screen.getByRole("columnheader", { name: new RegExp(name) }))
          .toBeVisible();
      }
      expect(lines(screen, "p")).toEqual([]);
      for (const name of ["Filter", "View"]) {
        const button = screen.getByRole("button", { name }).element();
        expect(button.textContent).toContain(name);
        expect(button.getBoundingClientRect().width).toBeGreaterThan(40);
      }
    });

    it("folds the description under the name between 32rem and 42rem, and Filter and View to icons", async () => {
      await browser.viewport(600, 900);
      const screen = await render(
        Page,
        props("/master/divisions?status=inactive,active&search=fleet")
      );

      // the column and its header go; Code and Updated stay
      await expect
        .element(screen.getByRole("columnheader", { name: /Description/ }))
        .not.toBeInTheDocument();
      await expect.element(screen.getByRole("columnheader", { name: /Code/ })).toBeVisible();
      await expect.element(screen.getByRole("columnheader", { name: /Updated/ })).toBeVisible();

      // its value rides under the name, marked as the column marked it
      const [second, ...others] = lines(screen, "td:first-child p");
      expect(others).toEqual([]);
      expect(second!.textContent).toContain("Fleet and day-to-day operations");
      expect(second!.querySelector("mark")?.textContent).toBe("Fleet");
      const name = second!.parentElement!.querySelector("a")!;
      expect(second!.getBoundingClientRect().top).toBeGreaterThan(
        name.getBoundingClientRect().bottom - 1
      );

      // Filter and View are icon buttons, still named, with their title and the badge in a corner
      for (const label of ["Filter", "View"]) {
        const button = screen.getByRole("button", { name: new RegExp(`^${label}`) }).element();
        expect(button.getBoundingClientRect().width).toBe(32);
        expect(button.getAttribute("title")).toMatch(new RegExp(`^${label}s?$`));
      }
      const filter = screen.getByRole("button", { name: /^Filter/ }).element();
      const badge = filter.querySelector("span.tabular-nums")!;
      expect(badge.textContent).toBe("1 in use");
      expect(getComputedStyle(badge).position).toBe("absolute");
    });

    it("folds rows to two lines under 32rem: the header row goes, a short second line stays", async () => {
      await browser.viewport(414, 896);
      const screen = await render(Page, props("/master/divisions"));

      expect(headers(screen)).toEqual([]);
      await expect.element(screen.getByRole("columnheader")).not.toBeInTheDocument();
      expect(lines(screen, "td:not(:first-child):not(:last-child)")).toEqual([]);

      // the first row's second line: the code, then the day alone (no time, no zone)
      const [first] = lines(screen, "td:first-child p");
      expect(first!.textContent!.replace(/\s+/g, " ").trim()).toMatch(
        /^OPS · Updated \d{1,2} \w{3} 2026$/
      );
      // long lines are cut with an ellipsis, not wrapped
      const style = getComputedStyle(first!);
      expect([style.whiteSpace, style.textOverflow, style.overflow]).toEqual([
        "nowrap",
        "ellipsis",
        "hidden"
      ]);
      // the description is not on this line (it only rides under the name above 32rem)
      expect(first!.textContent).not.toContain("Fleet");
    });

    it("says under 32rem what the columns show: a hidden Updated is not there, a shown Created is", async () => {
      await browser.viewport(414, 896);
      localStorage.setItem(
        "vmb:list-columns:divisions",
        JSON.stringify({
          name: true,
          code: true,
          description: true,
          updatedAt: false,
          createdAt: true
        })
      );
      const screen = await render(Page, props("/master/divisions"));

      await expect
        .poll(() => {
          const row = screen.getByRole("link", { name: "Operations" }).element().closest("tr")!;
          const line = [...row.querySelectorAll("td:first-child p")].find((p) =>
            p.checkVisibility()
          );
          return line?.textContent?.replace(/\s+/g, " ").trim();
        })
        .toMatch(/^OPS · Created \d{1,2} \w{3} 2026$/);
    });

    it("dims an inactive row's tile and name under 32rem, and leads its second line with Inactive", async () => {
      await browser.viewport(414, 896);
      const screen = await render(Page, props("/master/divisions"));

      const retired = screen.getByRole("link", { name: "Retired" }).element().closest("tr")!;
      const active = screen.getByRole("link", { name: "Operations" }).element().closest("tr")!;
      const tile = (row: Element) => row.querySelector<HTMLElement>("[data-slot=record-tile]")!;
      const nameOf = (row: Element) => row.querySelector<HTMLElement>("td:first-child a")!;

      expect(getComputedStyle(tile(retired)).opacity).toBe("0.55");
      expect(getComputedStyle(tile(retired)).filter).toContain("grayscale");
      expect(getComputedStyle(tile(active)).opacity).toBe("1");
      expect(getComputedStyle(nameOf(retired)).color).not.toBe(
        getComputedStyle(nameOf(active)).color
      );

      // the pill goes: the word moves to the line's lead
      expect(visible(retired.querySelector("[data-tone]"))).toBe(false);
      const second = [...retired.querySelectorAll("td:first-child p")].find((line) =>
        visible(line)
      )!;
      expect(second.textContent!.replace(/\s+/g, " ").trim()).toMatch(
        /^Inactive · RET · Updated \d{1,2} \w{3} 2026$/
      );
      expect(await axeViolations(document.body)).toEqual([]);
    });

    it("keeps the pill, and no dimming, from 32rem up", async () => {
      await browser.viewport(600, 900);
      const screen = await render(Page, props("/master/divisions"));

      const retired = screen.getByRole("link", { name: "Retired" }).element().closest("tr")!;
      expect(visible(retired.querySelector("[data-tone]"))).toBe(true);
      expect(getComputedStyle(retired.querySelector("[data-slot=record-tile]")!).opacity).toBe("1");
    });

    it("folds the free text and the tools on the same 42rem line", async () => {
      // the card's content is 2px under the viewport (its border)
      for (const [viewport, folded] of [
        [673, true],
        [674, false]
      ] as const) {
        await browser.viewport(viewport, 900);
        const screen = await render(Page, props("/master/divisions"));

        const header = screen.container.querySelector<HTMLElement>("thead th:nth-child(3)")!;
        expect(header.textContent).toContain("Description");
        expect(header.checkVisibility(), `${viewport}px: description column`).toBe(!folded);
        const view = screen.getByRole("button", { name: "View" }).element();
        expect(view.getBoundingClientRect().width === 32, `${viewport}px: icon buttons`).toBe(
          folded
        );
        await screen.unmount();
      }
    });

    it("folds the rows and swaps View's columns for Sort by on the same line, 32rem of card", async () => {
      // the card has a 1px border each side, so its content is 2px under the viewport
      for (const [viewport, folded] of [
        [513, true],
        [514, false]
      ] as const) {
        await browser.viewport(viewport, 900);
        const screen = await render(Page, props("/master/divisions"));

        expect(headers(screen).length === 0, `${viewport}px: no header row`).toBe(folded);
        await screen.getByRole("button", { name: "View" }).click();
        const sortBy = screen.getByRole("heading", { name: "Sort by" });
        const columns = screen.getByRole("heading", { name: "Columns" });
        await expect.element(folded ? sortBy : columns).toBeVisible();
        await expect.element(folded ? columns : sortBy).not.toBeInTheDocument();
        await userEvent.keyboard("{Escape}");
        await screen.unmount();
      }
    });

    it("reads the fold without checkVisibility, which Safari lacks before 17.4", async () => {
      const original = Element.prototype.checkVisibility;
      // @ts-expect-error simulating a browser without the method
      Element.prototype.checkVisibility = undefined;
      try {
        await browser.viewport(414, 896);
        const screen = await render(Page, props("/master/divisions"));
        await screen.getByRole("button", { name: "View" }).click();
        await expect.element(screen.getByRole("heading", { name: "Sort by" })).toBeVisible();
        await expect
          .element(screen.getByRole("heading", { name: "Columns" }))
          .not.toBeInTheDocument();
      } finally {
        Element.prototype.checkVisibility = original;
      }
    });

    it("opens the record from a folded row, the second line included, when no layer is open", async () => {
      await browser.viewport(414, 896);
      const screen = await render(Page, props("/master/divisions"));

      const row = screen.getByRole("link", { name: "Operations" }).element().closest("tr")!;
      const second = [...row.querySelectorAll("td:first-child p")].find((line) =>
        line.checkVisibility()
      )!;
      await browser.elementLocator(second).click();
      expect(goto).toHaveBeenCalledWith(`/master/divisions/${division.id}`);
    });

    it("has no sideways scroll at 1024, 768, 623 or 390, however long a name", async () => {
      const long = {
        ...division,
        name: "Domestic and international freight forwarding and customs brokerage division",
        description:
          "Accounts payable and receivable, payroll, tax filings, month-end close, board reporting and audit support"
      };
      for (const width of [1024, 768, 623, 390]) {
        await browser.viewport(width, 900);
        const screen = await render(
          Page,
          props("/master/divisions", { items: [long, { ...inactive, name: long.name }] })
        );
        const frame = screen.getByRole("table").element().parentElement!;
        expect(frame.scrollWidth, `${width}px: the table`).toBeLessThanOrEqual(frame.clientWidth);
        expect(document.documentElement.scrollWidth, `${width}px: the page`).toBeLessThanOrEqual(
          document.documentElement.clientWidth
        );
        await screen.unmount();
      }
    });
  });
});

// The list kit's polish (#397): what an owner's audit against the prototype found.
describe("list kit polish", () => {
  const size = (element: Element) => {
    const { width, height } = element.getBoundingClientRect();
    return [Math.round(width * 10) / 10, Math.round(height * 10) / 10];
  };
  const badge = (button: Element) => button.querySelector<HTMLElement>(".rounded-full")!;

  it("makes the Filter count a circle at full width and keeps the folded badge 16px, saying 'in use'", async () => {
    await browser.viewport(1280, 900);
    const wide = await render(Page, props("/master/divisions?status=active"));
    const button = wide.getByRole("button", { name: "Filter 1 in use" });
    await expect.element(button).toBeVisible();
    expect(size(badge(button.element()))).toEqual([20, 20]);
    wide.unmount();

    await browser.viewport(600, 900);
    const folded = await render(Page, props("/master/divisions?status=active"));
    const corner = folded.getByRole("button", { name: "Filter 1 in use" });
    await expect.element(corner).toBeVisible();
    expect(size(badge(corner.element()))).toEqual([16, 16]);
  });

  it("shows one date column in the Trash, Deleted, and leaves All as it was", async () => {
    await browser.viewport(1280, 900);
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    const trash = await render(Page, props("/master/divisions?trashed=only", { items: [trashed] }));

    await expect.element(trash.getByRole("columnheader", { name: /Deleted/ })).toBeVisible();
    await expect
      .element(trash.getByRole("columnheader", { name: /Updated/ }))
      .not.toBeInTheDocument();
    // Deleted is the updatedAt stamp, so sorting on it is that sort
    await expect
      .element(trash.getByRole("link", { name: "Deleted, sort ascending" }))
      .toHaveAttribute("href", "/master/divisions?trashed=only&sort=updatedAt&dir=asc");
    trash.unmount();

    const all = await render(Page, props("/master/divisions"));
    await expect.element(all.getByRole("columnheader", { name: /Updated/ })).toBeVisible();
    await expect
      .element(all.getByRole("columnheader", { name: /Deleted/ }))
      .not.toBeInTheDocument();
  });

  it("sizes the View panel w-64 with h-8 rows and h-7 rows-per-page buttons", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));
    await screen.getByRole("button", { name: "View" }).click();

    const panel = document.querySelector<HTMLElement>('[data-layer-frame="panel"]')!;
    // 16rem; offsetWidth, as the panel is still zooming in and a bounding box shrinks with it
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(panel.offsetWidth).toBe(16 * rem);
    expect(
      screen.getByRole("checkbox", { name: "Code" }).element().closest("label")!.offsetHeight
    ).toBe(32);
    expect((screen.getByRole("radio", { name: "50" }).element() as HTMLElement).offsetHeight).toBe(
      28
    );
  });

  it("makes Reset a muted text link in View and in Filter, with a focus ring", async () => {
    await browser.viewport(1280, 900);
    const view = await render(
      Page,
      props("/master/divisions?sort=code&dir=desc&perPage=50&status=active")
    );

    for (const [button, dialog] of [
      ["View changed", "View"],
      ["Filter 1 in use", "Filters"]
    ] as const) {
      await view.getByRole("button", { name: button }).click();
      const reset = view
        .getByRole("dialog", { name: dialog })
        .getByRole("button", { name: "Reset" });
      const style = getComputedStyle(reset.element());
      expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(style.textDecorationLine).toBe("none");
      // the footer count is the muted text colour
      expect(style.color).toBe(getComputedStyle(view.getByRole("status").element()).color);

      await userEvent.hover(reset);
      expect(getComputedStyle(reset.element()).textDecorationLine).toBe("underline");
      // the layer puts focus on its title; one Tab reaches Reset, by keyboard, so the ring shows
      await userEvent.keyboard("{Tab}");
      await expect.element(reset).toHaveFocus();
      expect(getComputedStyle(reset.element()).boxShadow).not.toBe("none");
      await userEvent.keyboard("{Escape}");
    }
  });

  it("mutes the desktop page numbers except the current one, and dims a disabled Previous on a phone", async () => {
    await browser.viewport(1280, 900);
    const desktop = await render(Page, props("/master/divisions?page=1", { total: 239 }));
    const pages = desktop.getByRole("navigation", { name: "Pages" });
    const color = (name: string) =>
      getComputedStyle(pages.getByRole("link", { name }).element()).color;
    expect(color("Page 2")).not.toBe(color("Page 1"));
    expect(color("Page 2")).toBe(getComputedStyle(desktop.getByRole("status").element()).color);
    desktop.unmount();

    await browser.viewport(390, 844);
    const phone = await render(Page, props("/master/divisions?page=1", { total: 239 }));
    const previous = phone.getByRole("link", { name: "Previous" }).element();
    expect(getComputedStyle(previous).opacity).toBe("0.5");
    expect(getComputedStyle(previous).pointerEvents).toBe("none");
  });
});

// The parity audit (#409): what docs/design/list-kit/parity.md pins that a test can check.
describe("list kit parity", () => {
  it("lets the name take the spare width from 32 to 42rem of card, down to 20ch, and truncate inside it", async () => {
    const long =
      "Corporate Services, Procurement, Logistics and Fleet Management Division of Indonesia";
    const items = [{ ...division, name: long, description: "Fleet and day-to-day operations" }];
    // 20ch in the cell's own font
    const ch = (element: Element) => {
      const probe = Object.assign(document.createElement("div"), { className: "w-[20ch]" });
      element.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    };

    await browser.viewport(660, 900);
    const band = await render(Page, props("/master/divisions", { items }));
    const head = band.getByRole("columnheader", { name: /^Name/ }).element();
    const cell = document.querySelector("tbody td")!;
    for (const element of [head, cell]) {
      const style = getComputedStyle(element);
      expect(style.maxWidth).toBe("0px");
      expect(parseFloat(style.minWidth)).toBeCloseTo(ch(element), 0);
    }
    // the long name is cut inside the cell, and the table needs no sideways scroll
    const link = band.getByRole("link", { name: long }).element();
    expect(link.scrollWidth).toBeGreaterThan(link.clientWidth);
    const frame = band.getByRole("table").element().parentElement!;
    expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
    band.unmount();

    // from 42rem the description column is back and the name is no longer the one to stretch
    await browser.viewport(1280, 900);
    const wide = await render(Page, props("/master/divisions", { items }));
    expect(
      getComputedStyle(wide.getByRole("columnheader", { name: /^Name/ }).element()).maxWidth
    ).toBe("none");
  });

  it("keeps the page gap at 16px, between the header and the card", async () => {
    await browser.viewport(1280, 900);
    await render(Page, props("/master/divisions"));

    const header = document.querySelector("h1")!.closest("header")!;
    const card = document.querySelector("[data-fold-probe]")!.parentElement!;
    expect(card.getBoundingClientRect().top - header.getBoundingClientRect().bottom).toBe(16);
  });

  it("gives View's column checkboxes the kit's cream fill and 3:1 edge, as Filter's", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));
    await screen.getByRole("button", { name: "View" }).click();
    // a ticked box is filled green; the edge and fill that matter are the unchecked box's
    const code = screen.getByRole("checkbox", { name: "Code" });
    await code.click();
    await expect.element(code).not.toBeChecked();
    await Promise.all(
      code
        .element()
        .getAnimations()
        .map((animation) => animation.finished)
    );

    const box = getComputedStyle(code.element());
    const probe = Object.assign(document.createElement("div"), {
      className: "border border-input"
    });
    document.body.append(probe);
    const edge = getComputedStyle(probe).borderTopColor;
    probe.remove();
    expect(box.borderTopColor).toBe(edge);
    expect(box.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("draws no focus ring on the row menu's box when it opens from the keyboard", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    screen.getByRole("button", { name: "Actions for Operations" }).element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByRole("menu")).toBeVisible();
    expect(getComputedStyle(screen.getByRole("menu").element()).outlineStyle).toBe("none");
  });
});
