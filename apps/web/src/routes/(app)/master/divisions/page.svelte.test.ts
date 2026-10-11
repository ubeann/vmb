import { DivisionListQuerySchema, type Division } from "@vmb/types";
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
  goto.mockClear();
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
      .element(screen.getByRole("link", { name: /^Trash 3 divisions$/ }))
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

  it("puts the tabs, search, Filter and Columns on the card's top edge, and the chips under them", async () => {
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
    expect(within(screen.getByRole("button", { name: "Columns" }).element())).toBe(true);

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

  it("opens the Filter menu from a chip, and a tick in it applies at once", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions?status=active"));

    await screen.getByRole("button", { name: "Status Active" }).click();
    const active = screen.getByRole("menuitemcheckbox", { name: "Active" });
    const inactive = screen.getByRole("menuitemcheckbox", { name: "Inactive" });
    await expect.element(active).toHaveAttribute("aria-checked", "true");
    await expect.element(inactive).toHaveAttribute("aria-checked", "false");

    await inactive.click();
    expect(goto).toHaveBeenCalledWith(
      "/master/divisions?status=active,inactive",
      expect.objectContaining({ noScroll: true })
    );
    // the menu stays open for the next choice
    await expect.element(active).toBeVisible();

    // the mocked page URL never moves, so this builds on the two ticks above
    await active.click();
    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?status=inactive",
      expect.objectContaining({ noScroll: true })
    );
  });

  it("keeps both choices when a second tick comes before the first navigation lands", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/divisions"));

    await screen.getByRole("button", { name: /^Filter/ }).click();
    await screen.getByRole("menuitemcheckbox", { name: "Active" }).click();
    await screen.getByRole("menuitemcheckbox", { name: "Inactive" }).click();

    // the page URL has not changed between the two ticks, as while a navigation is loading
    expect(goto).toHaveBeenLastCalledWith(
      "/master/divisions?status=active,inactive",
      expect.anything()
    );
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

  it("moves the chips into a Filters sheet on a narrow screen", async () => {
    const screen = await render(Page, props("/master/divisions?status=active"));

    await expect
      .element(screen.getByRole("link", { name: "Remove filter Status: Active" }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: /^Filters 1 active$/ }).click();

    const sheet = screen.getByRole("dialog", { name: "Filters" });
    await expect
      .element(sheet.getByRole("link", { name: "Remove filter Status: Active" }))
      .toHaveAttribute("href", "/master/divisions");
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
      .element(screen.getByRole("link", { name: /^Trash 3 divisions$/ }))
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

  it("hides a column from the menu and remembers it for the next visit", async () => {
    const screen = await render(Page, props("/master/divisions"));

    await expect.element(screen.getByRole("columnheader", { name: "Description" })).toBeVisible();
    await screen.getByRole("button", { name: "Columns" }).click();
    await screen.getByRole("menuitemcheckbox", { name: "Description" }).click();
    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByRole("columnheader", { name: "Description" }))
      .not.toBeInTheDocument();
    screen.unmount();

    const again = await render(Page, props("/master/divisions"));
    await expect
      .element(again.getByRole("columnheader", { name: "Description" }))
      .not.toBeInTheDocument();
  });
});
