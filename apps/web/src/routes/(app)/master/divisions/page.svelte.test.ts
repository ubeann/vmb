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
vi.mock("$app/navigation", () => ({ goto: vi.fn(), invalidateAll }));

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
  overrides: { items?: Division[]; total?: number; permissions?: string[]; failed?: boolean } = {}
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
      trashCount: 3
    } as PageData
  };
}

afterEach(async () => {
  localStorage.clear();
  vi.restoreAllMocks();
  toast.success.mockReset();
  toast.error.mockReset();
  invalidateAll.mockClear();
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

    // the All · Trash switch, with the Trash count, keeps the search
    await expect
      .element(screen.getByRole("link", { name: "All" }))
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
    await expect
      .element(screen.getByText("Active", { exact: true }))
      .toHaveAttribute("data-tone", "success");
    await expect
      .element(screen.getByText("Inactive", { exact: true }))
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
    expect(cell(/^Status/).getBoundingClientRect().width).toBeLessThan(120);

    const description = screen.getByText(text).element();
    expect(description.getAttribute("title")).toBe(text);
    expect(description.getBoundingClientRect().width).toBeLessThanOrEqual(
      parseFloat(getComputedStyle(description).fontSize) * 48
    );
    expect(description.scrollWidth).toBeGreaterThan(description.clientWidth);
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
    await reader.getByRole("button", { name: "Actions for Operations" }).click();
    await expect.element(reader.getByRole("menuitem", { name: "View" })).toBeVisible();
    await expect.element(reader.getByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    await expect.element(reader.getByRole("menuitem", { name: "Delete…" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    reader.unmount();

    const admin = await render(Page, props("/master/divisions"));
    await expect.element(admin.getByRole("link", { name: "New division" })).toBeVisible();
    await admin.getByRole("button", { name: "Actions for Operations" }).click();
    await expect.element(admin.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect.element(admin.getByRole("menuitem", { name: "Delete…" })).toBeVisible();
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

    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await screen.getByRole("menuitem", { name: "Restore" }).click();

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("A division with that name already exists.")
    );
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("offers Restore, not Edit or Delete, on a Trashed row", async () => {
    const trashed = { ...division, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(
      Page,
      props("/master/divisions?trashed=only", { items: [trashed] })
    );

    await expect
      .element(screen.getByRole("link", { name: /^Trash 3 divisions$/ }))
      .toHaveAttribute("aria-current", "page");
    await expect.element(screen.getByRole("columnheader", { name: "Deleted" })).toBeVisible();
    await screen.getByRole("button", { name: "Actions for Operations" }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Restore" })).toBeVisible();
    await expect.element(screen.getByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
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
