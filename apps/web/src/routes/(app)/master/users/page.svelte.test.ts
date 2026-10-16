import { UserListQuerySchema, type Division, type User } from "@vmb/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import { mockPage } from "$lib/mock-page.svelte.js";
import type { PageData } from "./$types.js";

vi.mock("$app/state", async () => ({
  page: (await import("$lib/mock-page.svelte.js")).mockPage,
  navigating: { to: null }
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("svelte-sonner", () => ({ toast }));
const invalidateAll = vi.fn(async () => {});
const goto = vi.fn(async () => {});
vi.mock("$app/navigation", () => ({
  goto,
  invalidateAll,
  preloadData: vi.fn(),
  pushState: vi.fn(),
  replaceState: vi.fn(),
  beforeNavigate: () => {},
  afterNavigate: () => {}
}));

// The form action's answer, as `use:enhance` would hand it to the page.
let deleteResult: { type: "success" | "failure"; status: number; data: Record<string, unknown> };
vi.mock("$app/forms", () => ({
  applyAction: vi.fn(),
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

const FINANCE = "d1000000-0000-4000-8000-000000000001";
const OPS = "d1000000-0000-4000-8000-000000000002";

const rina: User = {
  id: "u1000000-0000-4000-8000-000000000001",
  name: "Rina Wijaya",
  status: "active",
  roles: [
    { id: "r1", name: "Manager Finance" },
    { id: "r2", name: "Staff" }
  ],
  divisions: [{ id: FINANCE, name: "Finance" }],
  phone: "+628111000001",
  email: "rina@vmblogistics.id",
  emailVerified: true,
  profilePhotoPath: null,
  createdAt: "2026-01-05T01:00:00.000Z",
  updatedAt: "2026-10-05T03:04:00.000Z",
  deletedAt: null
};

const siti: User = {
  ...rina,
  id: "u1000000-0000-4000-8000-000000000002",
  name: "Siti Lestari",
  email: "siti@vmblogistics.id",
  status: "suspended",
  roles: [],
  divisions: [],
  emailVerified: false
};

const budi: User = {
  ...rina,
  id: "u1000000-0000-4000-8000-000000000003",
  name: "Budi Santoso",
  email: "budi@vmblogistics.id",
  status: "inactive"
};

const division = (id: string, name: string): Division => ({
  id,
  name,
  code: name.slice(0, 3).toUpperCase(),
  description: null,
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: true,
  createdAt: "2026-01-05T01:00:00.000Z",
  updatedAt: "2026-01-05T01:00:00.000Z",
  deletedAt: null
});

const ALL = [
  "master-users.view_any",
  "master-users.view",
  "master-users.create",
  "master-users.update",
  "master-users.delete",
  "master-users.restore"
];

function props(
  url: string,
  overrides: {
    items?: User[];
    total?: number;
    outOf?: number;
    permissions?: string[];
    failed?: boolean;
    divisions?: Division[];
  } = {}
) {
  mockPage.url = new URL(url, "http://localhost");
  mockPage.state = {};
  const items = overrides.items ?? [rina, siti, budi];
  return {
    data: {
      user: null,
      division: null,
      permissions: overrides.permissions ?? ALL,
      sidebarOpen: true,
      query: UserListQuerySchema.parse(Object.fromEntries(mockPage.url.searchParams)),
      users: overrides.failed
        ? null
        : {
            items,
            total: overrides.total ?? items.length,
            page: 1,
            perPage: 25,
            views: { all: overrides.total ?? items.length, trash: 2 },
            facets: {
              status: { active: 1, inactive: 1, suspended: 1 },
              division: { [FINANCE]: 2 }
            }
          },
      trashCount: 2,
      outOf: overrides.outOf ?? null,
      divisions: overrides.divisions ?? [division(FINANCE, "Finance"), division(OPS, "Operations")]
    } as unknown as PageData
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

describe("users list", () => {
  it("renders the toolbar, the tabs, the identity cell, Division, Verified and the footer", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users?search=a&status=active,suspended"));

    await expect.element(screen.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect.element(screen.getByRole("searchbox", { name: "Search users" })).toHaveValue("a");

    // the All · Trash tabs, each with its count, keep the search and the filters
    await expect
      .element(screen.getByRole("link", { name: /^All 3 users$/ }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(screen.getByRole("link", { name: /^Trash 2 deleted users$/ }))
      .toHaveAttribute("href", "/master/users?search=a&status=active,suspended&trashed=only");

    // each filter is one removable chip
    await expect
      .element(screen.getByRole("link", { name: "Remove filter Status: Active, Suspended" }))
      .toHaveAttribute("href", "/master/users?search=a");

    // the identity cell: avatar, name and, under it, the email
    const table = screen.getByRole("table");
    await expect
      .element(table.getByRole("link", { name: "Rina Wijaya" }))
      .toHaveAttribute("href", "/master/users/u1000000-0000-4000-8000-000000000001");
    await expect.element(table.getByText("rina@vmblogistics.id").first()).toBeVisible();
    // the columns the ticket names, and the first one sorted
    await expect
      .element(screen.getByRole("columnheader", { name: /Name/ }))
      .toHaveAttribute("aria-sort", "ascending");
    await expect.element(table.getByRole("columnheader", { name: "Division" })).toBeVisible();
    await expect.element(table.getByRole("columnheader", { name: "Verified" })).toBeVisible();
    await expect.element(table.getByRole("cell", { name: "Finance" }).first()).toBeVisible();
    await expect.element(table.getByText("Verified", { exact: true }).first()).toBeVisible();
    await expect.element(table.getByText("Not verified").first()).toBeVisible();

    await expect.element(screen.getByText("3 users")).toBeVisible();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("has no Status column: only a Suspended or Inactive user is marked, Active shows nothing", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users"));

    const table = screen.getByRole("table");
    await expect
      .element(table.getByRole("columnheader", { name: "Status" }))
      .not.toBeInTheDocument();
    await expect.element(table.getByText("Active", { exact: true })).not.toBeInTheDocument();
    await expect
      .element(table.getByText("Suspended", { exact: true }).first())
      .toHaveAttribute("data-tone", "warning");
    await expect
      .element(table.getByText("Inactive", { exact: true }).first())
      .toHaveAttribute("data-tone", "neutral");
  });

  it("hides Created and Updated by default and lists them in View", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users"));

    await expect
      .element(screen.getByRole("columnheader", { name: /^Updated/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("columnheader", { name: /^Created/ }))
      .not.toBeInTheDocument();

    await screen.getByRole("button", { name: /^View/ }).click();
    const panel = screen.getByRole("dialog", { name: "View" });
    await expect.element(panel.getByRole("checkbox", { name: "Updated" })).not.toBeChecked();
    await panel.getByRole("checkbox", { name: "Created" }).click();
    await expect.element(screen.getByRole("columnheader", { name: /^Created/ })).toBeVisible();
  });

  it("filters by Status and by Division from the Filter panel, with counts, several values each", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users?status=active"));

    await screen.getByRole("button", { name: /^Filter/ }).click();
    const panel = screen.getByRole("dialog", { name: "Filters" });
    await expect.element(panel.getByRole("checkbox", { name: /^Active/ })).toBeChecked();
    await expect.element(panel.getByRole("checkbox", { name: /^Suspended/ })).not.toBeChecked();
    // each Division with the users it would give, a Division with nobody in it saying 0
    await expect.element(panel.getByRole("checkbox", { name: /^Finance\s*2$/ })).toBeVisible();
    await expect.element(panel.getByRole("checkbox", { name: /^Operations\s*0$/ })).toBeVisible();

    await panel.getByRole("checkbox", { name: /^Suspended/ }).click();
    expect(goto).toHaveBeenLastCalledWith(
      "/master/users?status=active,suspended",
      expect.objectContaining({ noScroll: true })
    );

    await panel.getByRole("checkbox", { name: /^Finance/ }).click();
    expect(goto).toHaveBeenLastCalledWith(
      `/master/users?status=active,suspended&division=${FINANCE}`,
      expect.objectContaining({ noScroll: true })
    );
  });

  it("names a Division filter by its Division on the chip, and gives a long list a search box", async () => {
    await browser.viewport(1280, 900);
    const many = Array.from({ length: 9 }, (_, index) =>
      division(`d1000000-0000-4000-8000-0000000001${index}0`, `Branch ${index + 1}`)
    );
    const screen = await render(
      Page,
      props(`/master/users?division=${many[2]!.id}`, { divisions: many })
    );

    await expect.element(screen.getByRole("button", { name: "Division Branch 3" })).toBeVisible();

    await screen.getByRole("button", { name: /^Filter/ }).click();
    const panel = screen.getByRole("dialog", { name: "Filters" });
    const search = panel.getByRole("searchbox", { name: "Search division" });
    await expect.element(search).toBeVisible();
    await userEvent.type(search, "branch 7");
    await expect.element(panel.getByRole("checkbox", { name: /^Branch 7/ })).toBeVisible();
    await expect
      .element(panel.getByRole("checkbox", { name: /^Branch 2/ }))
      .not.toBeInTheDocument();
  });

  it("gives Status, a short list, no search box", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users"));

    await screen.getByRole("button", { name: /^Filter/ }).click();
    const panel = screen.getByRole("dialog", { name: "Filters" });
    await expect.element(panel.getByRole("checkbox", { name: /^Active/ })).toBeVisible();
    await expect
      .element(panel.getByRole("searchbox", { name: "Search division" }))
      .not.toBeInTheDocument();
  });

  it("offers each action only to a caller who holds its permission", async () => {
    const reader = await render(
      Page,
      props("/master/users", { permissions: ["master-users.view_any", "master-users.view"] })
    );
    await expect.element(reader.getByRole("link", { name: "New user" })).not.toBeInTheDocument();
    await expect
      .element(reader.getByRole("button", { name: /^Actions for / }))
      .not.toBeInTheDocument();
    // what a row has when nothing can be changed: to look
    await expect
      .element(reader.getByRole("link", { name: "View Rina Wijaya" }))
      .toHaveAttribute("href", "/master/users/u1000000-0000-4000-8000-000000000001");
    reader.unmount();

    const editor = await render(
      Page,
      props("/master/users", { permissions: ["master-users.view_any", "master-users.update"] })
    );
    await expect
      .element(editor.getByRole("link", { name: "Edit Rina Wijaya" }))
      .toHaveAttribute("href", "/master/users/u1000000-0000-4000-8000-000000000001/edit");
    editor.unmount();

    const admin = await render(Page, props("/master/users"));
    await expect
      .element(admin.getByRole("link", { name: "New user" }))
      .toHaveAttribute("href", "/master/users/new");
    await admin.getByRole("button", { name: "Actions for Rina Wijaya" }).click();
    await expect.element(admin.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect.element(admin.getByRole("menuitem", { name: "Delete…" })).toBeVisible();
  });

  it("opens the user on a click anywhere on the row, but not from its own controls", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users"));

    const row = screen.getByRole("row", { name: /Rina Wijaya/ }).element();
    row.querySelector<HTMLElement>("td:nth-child(2)")?.click();
    expect(goto).toHaveBeenCalledWith("/master/users/u1000000-0000-4000-8000-000000000001");

    goto.mockClear();
    await screen.getByRole("button", { name: "Actions for Rina Wijaya" }).click();
    expect(goto).not.toHaveBeenCalled();
  });

  it("asks before deleting, and says the user can come back and that their sessions end", async () => {
    const screen = await render(Page, props("/master/users"));

    await screen.getByRole("button", { name: "Actions for Rina Wijaya" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();

    const dialog = screen.getByRole("dialog", { name: "Delete Rina Wijaya?" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText(/where you can restore it\./)).toBeVisible();
    await expect.element(dialog.getByText(/Their sessions end now\./)).toBeVisible();
    // the user, as their row shows them, so it is plain which one goes
    await expect.element(dialog.getByText("rina@vmblogistics.id")).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Delete" })).toBeVisible();
    expect(dialog.getByRole("button", { name: "Close" }).elements()).toHaveLength(0);
  });

  it("moves a deleted user to the Trash and offers to undo it from the toast", async () => {
    deleteResult = { type: "success", status: 200, data: { ok: true } };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(actionReply("success", 200, '{"ok":true}'));
    const screen = await render(Page, props("/master/users"));

    await screen.getByRole("button", { name: "Actions for Rina Wijaya" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Rina Wijaya moved to Trash",
        expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) })
      )
    );

    const [, options] = toast.success.mock.calls[0] as [string, { action: { onClick(): void } }];
    options.action.onClick();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rina Wijaya restored"));
    expect(fetch).toHaveBeenCalledWith(
      "/master/users?/restore",
      expect.objectContaining({ method: "POST" })
    );
    expect((fetch.mock.calls[0]?.[1]?.body as FormData).get("id")).toBe(rina.id);
    expect(invalidateAll).toHaveBeenCalled();
  });

  it("offers no Undo to a caller who may not restore", async () => {
    deleteResult = { type: "success", status: 200, data: { ok: true } };
    const screen = await render(
      Page,
      props("/master/users", { permissions: ["master-users.view_any", "master-users.delete"] })
    );

    await screen.getByRole("button", { name: "Delete Rina Wijaya" }).click();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Rina Wijaya moved to Trash", {
        duration: 10_000,
        action: undefined
      })
    );
  });

  it("keeps the dialog open with the API's refusal when the caller may not change the user", async () => {
    const message = "You cannot change a user who holds permissions you do not have.";
    deleteResult = {
      type: "failure",
      status: 403,
      data: { error: message, code: "PERMISSION_ESCALATION" }
    };
    const screen = await render(Page, props("/master/users"));

    await screen.getByRole("button", { name: "Actions for Rina Wijaya" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await expect.element(screen.getByRole("dialog").getByText(message)).toBeVisible();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the Trash with its Deleted column, says why, and restores through the API", async () => {
    await browser.viewport(1280, 900);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(actionReply("success", 200, '{"ok":true}'));
    const trashed = { ...rina, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(Page, props("/master/users?trashed=only", { items: [trashed] }));

    await expect
      .element(screen.getByRole("link", { name: /^Trash 2 deleted users$/ }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(
        screen.getByText(
          "Deleted users stay here for the audit trail. Restore one to let them sign in again."
        )
      )
      .toBeVisible();
    await expect.element(screen.getByRole("columnheader", { name: /^Deleted/ })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /^Actions for / }))
      .not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Restore Rina Wijaya" }).click();

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rina Wijaya restored"));
    expect(fetch).toHaveBeenCalledWith(
      "/master/users?/restore",
      expect.objectContaining({ method: "POST" })
    );
    expect(invalidateAll).toHaveBeenCalled();
  });

  it("shows the API's message when a restore is refused", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      actionReply(
        "failure",
        403,
        '{"error":"You cannot change a user who holds permissions you do not have."}'
      )
    );
    const trashed = { ...rina, deletedAt: "2026-10-06T01:00:00.000Z" };
    const screen = await render(Page, props("/master/users?trashed=only", { items: [trashed] }));

    await screen.getByRole("button", { name: "Restore Rina Wijaya" }).click();

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You cannot change a user who holds permissions you do not have."
      )
    );
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("has no legacy 'With trashed' option: the Trash is a tab", async () => {
    const screen = await render(Page, props("/master/users"));

    expect(screen.getByText(/with trashed/i).elements()).toHaveLength(0);
    expect(document.querySelector("select")).toBeNull();
  });

  it("tells an empty list, a search with no match, an empty Trash and a failure apart", async () => {
    const none = await render(Page, props("/master/users", { items: [] }));
    await expect.element(none.getByRole("heading", { name: "No users yet" })).toBeVisible();
    await expect.element(none.getByRole("link", { name: "New user" }).first()).toBeVisible();
    none.unmount();

    const noMatch = await render(Page, props("/master/users?search=zzz", { items: [] }));
    await expect.element(noMatch.getByRole("heading", { name: "No users match" })).toBeVisible();
    await expect
      .element(noMatch.getByRole("link", { name: "Clear search and filters" }))
      .toHaveAttribute("href", "/master/users");
    noMatch.unmount();

    const trash = await render(Page, props("/master/users?trashed=only", { items: [] }));
    await expect.element(trash.getByRole("heading", { name: "The Trash is empty" })).toBeVisible();
    trash.unmount();

    const failed = await render(Page, props("/master/users", { failed: true }));
    await expect.element(failed.getByText("Could not load users. Please try again.")).toBeVisible();
  });

  it("marks the searched text in the name and the email", async () => {
    await browser.viewport(1280, 900);
    await render(Page, props("/master/users?search=wij", { items: [rina] }));

    const marks = Array.from(document.querySelectorAll("mark")).map((mark) => mark.textContent);
    expect(marks).toContain("Wij");
  });

  describe("answers to the card's width (ADR-0051 rule 11)", () => {
    it("keeps the email under the name on a wide card, and the roles in their column", async () => {
      await browser.viewport(1280, 900);
      const screen = await render(Page, props("/master/users"));

      await expect.element(screen.getByRole("columnheader", { name: "Roles" })).toBeVisible();
      await expect
        .element(screen.getByRole("cell", { name: "Manager Finance, Staff" }).first())
        .toBeVisible();
    });

    it("folds rows to two lines under 32rem: the header row goes, the status word leads the email", async () => {
      await browser.viewport(414, 896);
      const screen = await render(Page, props("/master/users"));

      await expect.element(screen.getByRole("columnheader")).not.toBeInTheDocument();
      // the lines a row shows under its name: what is not hidden at this width
      const shown = (name: RegExp) =>
        Array.from(
          screen
            .getByRole("row", { name })
            .element()
            .querySelectorAll<HTMLElement>("td:first-child p")
        )
          .filter((line) => getComputedStyle(line).display !== "none")
          .map((line) => line.textContent?.replace(/\s+/g, " ").trim());
      expect(shown(/Siti Lestari/)).toEqual(["Suspended · siti@vmblogistics.id"]);
      // an Active user's line starts with the email, then the Division
      expect(shown(/Rina Wijaya/)).toEqual(["rina@vmblogistics.id · Finance"]);
    });

    it("has no sideways scroll at 1024, 768 and 390, however long a name", async () => {
      const long = {
        ...rina,
        name: "Rina Wijaya Kusumawardhani Putri Anggraeni Santoso",
        email: "rina.wijaya.kusumawardhani.putri@vmblogistics.id"
      };
      for (const width of [1024, 768, 390]) {
        await browser.viewport(width, 900);
        const screen = await render(Page, props("/master/users", { items: [long, siti] }));
        const frame = screen.getByRole("table").element().parentElement!;
        expect(frame.scrollWidth, `at ${width}px`).toBeLessThanOrEqual(frame.clientWidth);
        await screen.unmount();
      }
    });
  });

  it("has no axe violations with a row menu open and in the Trash", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users"));
    await screen.getByRole("button", { name: "Actions for Rina Wijaya" }).click();
    await expect.element(screen.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    // axe reads colours, which are blended until the menu's entrance animation has finished
    const menu = screen.getByRole("menu").element();
    await Promise.all(menu.getAnimations({ subtree: true }).map((animation) => animation.finished));
    expect(await axeViolations(document.body)).toEqual([]);
    await userEvent.keyboard("{Escape}");
    screen.unmount();

    const trashed = { ...rina, deletedAt: "2026-10-06T01:00:00.000Z" };
    await render(Page, props("/master/users?trashed=only", { items: [trashed] }));
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe("selecting users for a bulk action (#305)", () => {
  // the bar's own count; the footer says "3 users" in a status of its own
  const bar = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.getByRole("region", { name: "Bulk actions for users" });
  const trashed = [
    { ...rina, deletedAt: "2026-10-06T01:00:00.000Z" },
    { ...siti, deletedAt: "2026-10-06T02:00:00.000Z" }
  ];

  it("puts a checkbox in each row's name cell and one in the header that selects the page, and swaps the toolbar for the bar", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users", { total: 40 }));

    expect(bar(screen).elements()).toHaveLength(0);
    const header = screen.getByRole("checkbox", { name: "Select all 3 on this page" });
    await screen.getByRole("checkbox", { name: "Select Rina Wijaya" }).click();
    await expect.element(header).toHaveAttribute("aria-checked", "mixed");

    await header.click();
    // the page's three rows, not the 40 the list holds
    await expect.element(bar(screen).getByRole("status")).toHaveTextContent("3 selected");
    await expect.element(bar(screen).getByRole("button", { name: "Delete…" })).toBeVisible();
    expect(screen.getByRole("searchbox").elements()).toHaveLength(0);

    await bar(screen).getByRole("button", { name: "Clear" }).click();
    await expect.element(screen.getByRole("searchbox", { name: "Search users" })).toBeVisible();
    await expect.element(header).toHaveFocus();
  });

  it("clears the selection when the filters, the sort or the page change", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users"));
    await screen.getByRole("checkbox", { name: "Select Rina Wijaya" }).click();
    await expect.element(bar(screen).getByRole("status")).toHaveTextContent("1 selected");

    for (const search of ["?status=active", "?sort=email&dir=desc", "?page=2"]) {
      mockPage.url = new URL(`/master/users${search}`, "http://localhost");
      await expect.element(bar(screen)).not.toBeInTheDocument();
      await screen.getByRole("checkbox", { name: "Select Rina Wijaya" }).click();
      await expect.element(bar(screen).getByRole("status")).toHaveTextContent("1 selected");
    }
  });

  it("is not offered to a caller who may not delete, or in the Trash to one who may not restore", async () => {
    await browser.viewport(1280, 900);
    const noDelete = await render(
      Page,
      props("/master/users", { permissions: ALL.filter((key) => !key.endsWith(".delete")) })
    );
    expect(noDelete.getByRole("checkbox").elements()).toHaveLength(0);
    await noDelete.unmount();

    const noRestore = await render(
      Page,
      props("/master/users?trashed=only", {
        items: trashed,
        permissions: ALL.filter((key) => !key.endsWith(".restore"))
      })
    );
    expect(noRestore.getByRole("checkbox").elements()).toHaveLength(0);
  });

  it("asks naming the count and that their sessions end, then offers an Undo that restores the same rows", async () => {
    await browser.viewport(1280, 900);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(actionReply("success", 200, '{"ok":true}'));
    const screen = await render(Page, props("/master/users"));
    await screen.getByRole("checkbox", { name: "Select Rina Wijaya" }).click();
    await screen.getByRole("checkbox", { name: "Select Siti Lestari" }).click();
    await screen.getByRole("button", { name: "Delete…" }).click();

    const dialog = screen.getByRole("dialog", { name: "Delete 2 users?" });
    await expect
      .element(dialog.getByText(/They move to the Trash, where you can restore them\./))
      .toBeVisible();
    await expect.element(dialog.getByText(/Their sessions end now\./)).toBeVisible();
    const form = dialog.element().querySelector("form")!;
    expect(new FormData(form).get("action")).toBe("delete");
    expect(new FormData(form).getAll("ids")).toEqual([rina.id, siti.id]);

    deleteResult = { type: "success", status: 200, data: { ok: true } };
    await dialog.getByRole("button", { name: "Delete" }).click();

    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "2 users moved to Trash",
        expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) })
      )
    );
    expect(bar(screen).elements()).toHaveLength(0);

    const [, options] = toast.success.mock.calls[0] as [string, { action: { onClick(): void } }];
    options.action.onClick();
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 users restored"));
    expect(fetch).toHaveBeenCalledWith(
      "/master/users?/bulk",
      expect.objectContaining({ method: "POST" })
    );
    const body = fetch.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("action")).toBe("restore");
    expect(body.getAll("ids")).toEqual([rina.id, siti.id]);
    expect(invalidateAll).toHaveBeenCalled();
  });

  it("keeps the dialog open when a user is out of the caller's reach, naming them, and deletes none", async () => {
    await browser.viewport(1280, 900);
    const message =
      "You cannot change a user who holds permissions you do not have: “Siti Lestari”. Nothing was changed.";
    deleteResult = {
      type: "failure",
      status: 403,
      data: { error: message, code: "PERMISSION_ESCALATION" }
    };
    const screen = await render(Page, props("/master/users"));
    await screen.getByRole("checkbox", { name: "Select all 3 on this page" }).click();
    await screen.getByRole("button", { name: "Delete…" }).click();
    const dialog = screen.getByRole("dialog", { name: "Delete 3 users?" });
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect.element(dialog.getByRole("alert")).toBeVisible();
    expect(dialog.getByRole("alert").element().textContent).toContain(message);
    expect(toast.error).not.toHaveBeenCalled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect.element(bar(screen).getByRole("status")).toHaveTextContent("3 selected");
  });

  it("offers Restore, not Delete, in the Trash, and restores the chosen rows in one request", async () => {
    await browser.viewport(1280, 900);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(actionReply("success", 200, '{"ok":true}'));
    const screen = await render(Page, props("/master/users?trashed=only", { items: trashed }));
    await screen.getByRole("checkbox", { name: "Select all 2 on this page" }).click();

    expect(bar(screen).getByRole("button", { name: "Delete…" }).elements()).toHaveLength(0);
    await bar(screen).getByRole("button", { name: "Restore" }).click();

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 users restored"));
    const body = fetch.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("action")).toBe("restore");
    expect(body.getAll("ids")).toEqual([rina.id, siti.id]);
    expect(bar(screen).elements()).toHaveLength(0);
  });

  it("has no axe violations with rows chosen, and fits a phone without a sideways scroll", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/users"));
    await screen.getByRole("checkbox", { name: "Select Rina Wijaya" }).click();
    await expect.element(bar(screen).getByRole("status")).toHaveTextContent("1 selected");
    expect(await axeViolations(document.body)).toEqual([]);

    await browser.viewport(375, 667);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
  });
});
