import {
  RoleInputSchema,
  RoleListQuerySchema,
  RoleUpdateInputSchema,
  type Role,
  type RoleDetail
} from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; axe's colour reads need it.
import "../../../../app.css";

import { axeViolations } from "$lib/a11y-support.js";
import { roleFormData } from "$lib/master/form-data.js";
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
// SvelteKit's shallow routing, as far as the record layer uses it (#302): the
// entries pushed over the list, which `history.go` moves through
let entries: { url: URL; state: App.PageState }[] = [];
let at = 0;
function showEntry() {
  mockPage.url = entries[at]!.url;
  mockPage.state = entries[at]!.state;
}
// what each record page's load gives the layer
let layerPermissions: string[] = [];
async function loadLayer(href: string) {
  const [, id, edit] = href.match(/^\/master\/roles\/([^/?]+)(\/edit)?$/) ?? [];
  if (id === "new") {
    const form = await superValidate(zod4(RoleInputSchema), { errors: false });
    form.data.isActive = true;
    return { type: "loaded" as const, status: 200, data: { form } };
  }
  const record = [staff, inactive, admin].find((role) => role.id === id);
  if (!record) return { type: "loaded" as const, status: 404, data: {} };
  const detail: RoleDetail = { ...record, divisionName: null };
  if (edit) {
    const form = await superValidate(roleFormData(record), zod4(RoleUpdateInputSchema));
    return { type: "loaded" as const, status: 200, data: { role: detail, form } };
  }
  return {
    type: "loaded" as const,
    status: 200,
    data: { role: detail, permissions: layerPermissions }
  };
}
const preloadData = vi.fn(loadLayer);
const pushState = vi.fn((href: string, state: App.PageState) => {
  entries.splice(at + 1, Infinity, { url: new URL(href, "http://localhost"), state });
  at++;
  showEntry();
});
const replaceState = vi.fn((href: string, state: App.PageState) => {
  entries[at] = { url: new URL(href, "http://localhost"), state };
  showEntry();
});
vi.mock("$app/navigation", () => ({
  goto,
  invalidateAll,
  preloadData,
  pushState,
  replaceState,
  beforeNavigate: () => {},
  afterNavigate: () => {}
}));
beforeEach(() => {
  vi.spyOn(history, "go").mockImplementation((delta = 0) => {
    at += delta;
    showEntry();
  });
  // a row's hover and press preload too, which would blur `preloadData` as the sign that
  // a row opened
  vi.spyOn(LayerRoute.prototype, "preloadOn").mockReturnValue({} as never);
});

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

const { render } = await import("vitest-browser-svelte");
const { default: Page } = await import("./+page.svelte");
const { LayerRoute } = await import("$lib/components/list/layer/layer-route.svelte.js");

const staff: Role = {
  id: "d1000000-0000-4000-8000-000000000001",
  name: "Staff",
  isActive: true,
  isSystem: false,
  colorHex: "#805AD5",
  iconName: "heroicon-o-user",
  description: "Supports daily operations",
  divisionId: null,
  createdAt: "2026-01-05T01:00:00.000Z",
  updatedAt: "2026-10-05T03:04:00.000Z"
};

const inactive: Role = {
  ...staff,
  id: "d1000000-0000-4000-8000-000000000002",
  name: "Auditor",
  description: null,
  isActive: false
};

const admin: Role = {
  ...staff,
  id: "d1000000-0000-4000-8000-000000000003",
  name: "Administrator",
  description: "Everything",
  isSystem: true
};

const ALL = [
  "master-roles.view_any",
  "master-roles.view",
  "master-roles.create",
  "master-roles.update",
  "master-roles.delete"
];

function props(
  url: string,
  overrides: {
    items?: Role[];
    total?: number;
    outOf?: number;
    permissions?: string[];
    failed?: boolean;
  } = {}
) {
  mockPage.url = new URL(url, "http://localhost");
  mockPage.state = {};
  entries = [{ url: mockPage.url, state: {} }];
  at = 0;
  layerPermissions = overrides.permissions ?? ALL;
  const items = overrides.items ?? [staff, inactive, admin];
  return {
    data: {
      user: null,
      division: null,
      permissions: overrides.permissions ?? ALL,
      sidebarOpen: true,
      query: RoleListQuerySchema.parse(Object.fromEntries(mockPage.url.searchParams)),
      roles: overrides.failed
        ? null
        : {
            items,
            total: overrides.total ?? items.length,
            page: 1,
            perPage: 25,
            facets: { status: { active: 2, inactive: 1 } }
          },
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
  preloadData.mockClear();
  preloadData.mockImplementation(loadLayer);
  pushState.mockClear();
  await browser.viewport(414, 896);
});

describe("roles list", () => {
  it("renders the toolbar with no tabs, sortable headers, the exceptions only, and the footer", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles?search=a&status=active", { total: 60 }));

    await expect.element(screen.getByRole("heading", { name: "Roles", level: 1 })).toBeVisible();
    await expect.element(screen.getByRole("searchbox", { name: "Search roles" })).toHaveValue("a");

    // Roles have no Trash: no All · Trash tabs
    expect(screen.getByRole("navigation", { name: /views/i }).elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: /^Trash/ }).elements()).toHaveLength(0);

    // the status in use is one removable chip
    await expect
      .element(screen.getByRole("link", { name: "Remove filter Status: Active" }))
      .toHaveAttribute("href", "/master/roles?search=a");

    // the default sort is by name, ascending, and the header says so; there is no level column
    await expect
      .element(screen.getByRole("columnheader", { name: /Name/ }))
      .toHaveAttribute("aria-sort", "ascending");
    await expect
      .element(screen.getByRole("link", { name: "Updated, sort ascending" }))
      .toHaveAttribute("href", "/master/roles?search=a&status=active&sort=updatedAt&dir=asc");
    const table = screen.getByRole("table");
    for (const gone of ["Level", "Access level", "Guard", "Status", "Color"]) {
      expect(table.getByRole("columnheader", { name: gone }).elements()).toHaveLength(0);
    }

    // only the exception is marked: the inactive row has the pill, an active one says nothing
    await expect
      .element(table.getByText("Inactive", { exact: true }).first())
      .toHaveAttribute("data-tone", "neutral");
    await expect.element(table.getByText("Active", { exact: true })).not.toBeInTheDocument();

    await expect.element(screen.getByText("Showing 1–25 of 60")).toBeVisible();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("says what the page is in one line, with the action on the title row", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    await expect
      .element(screen.getByText(/^Named sets of permissions that you give to users\.$/))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "New role" }))
      .toHaveAttribute("href", "/master/roles/new");
  });

  it("puts the search at the left of the card's top edge, Filter and View at its right", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    const search = screen
      .getByRole("searchbox", { name: "Search roles" })
      .element()
      .getBoundingClientRect();
    const view = screen.getByRole("button", { name: /^View/ }).element().getBoundingClientRect();
    const card = screen.getByRole("table").element().getBoundingClientRect();
    expect(search.left - card.left).toBeLessThan(40);
    expect(card.right - view.right).toBeLessThan(40);
  });

  it("shows the Status options with their counts in the Filter panel", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("button", { name: /^Filter/ }).click();

    const panel = screen.getByRole("dialog", { name: "Filters" });
    await expect.element(panel.getByRole("checkbox", { name: /^Active\s*2/ })).toBeVisible();
    await expect.element(panel.getByRole("checkbox", { name: /^Inactive\s*1/ })).toBeVisible();
  });

  it("says in the phone's sheet how many roles it shows, a list having no view to count in", async () => {
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("button", { name: /^Filter/ }).click();

    await expect
      .element(
        screen
          .getByRole("dialog", { name: "Filters" })
          .getByRole("button", { name: "Show 3 roles" })
      )
      .toBeVisible();
  });

  it("marks a System Role with a lock badge next to its name, and no other row", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    const badges = document.querySelectorAll("[data-slot=system-badge]");
    expect(badges).toHaveLength(1);
    expect(badges[0]?.textContent?.trim()).toBe("System");
    expect(badges[0]?.querySelector("svg")).not.toBeNull();
    // it sits in the name's cell, beside the link
    const cell = screen.getByRole("link", { name: "Administrator" }).element().closest("td");
    expect(cell?.contains(badges[0] ?? null)).toBe(true);
  });

  it("offers a System Role View alone, as a button and not a menu, never Edit or Delete", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    await expect
      .element(screen.getByRole("button", { name: "Actions for Administrator" }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("link", { name: "Edit Administrator" }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Delete Administrator" }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("link", { name: "View Administrator" }))
      .toHaveAttribute("href", `/master/roles/${admin.id}`);

    // an ordinary role has the menu with Edit and Delete…, and no View
    await screen.getByRole("button", { name: "Actions for Staff" }).click();
    const items = screen.getByRole("menuitem").elements();
    expect(items.map((item) => item.textContent?.trim())).toEqual(["EditE", "Delete…"]);
  });

  it("offers each action only to a caller who holds its permission", async () => {
    const reader = await render(
      Page,
      props("/master/roles", { permissions: ["master-roles.view_any", "master-roles.view"] })
    );
    await expect.element(reader.getByRole("link", { name: "New role" })).not.toBeInTheDocument();
    await expect
      .element(reader.getByRole("button", { name: /^Actions for / }))
      .not.toBeInTheDocument();
    // with nothing to change, a row offers to look
    await expect.element(reader.getByRole("link", { name: "View Staff" })).toBeVisible();
    reader.unmount();

    const editor = await render(
      Page,
      props("/master/roles", {
        permissions: ["master-roles.view_any", "master-roles.update"]
      })
    );
    // one action is a button in the row (ADR-0051 rule 8)
    await expect.element(editor.getByRole("link", { name: "Edit Staff" })).toBeVisible();
    await expect.element(editor.getByRole("button", { name: /^Delete / })).not.toBeInTheDocument();
    editor.unmount();

    const remover = await render(
      Page,
      props("/master/roles", { permissions: ["master-roles.view_any", "master-roles.delete"] })
    );
    await remover.getByRole("button", { name: "Delete Staff" }).click();
    await expect
      .element(remover.getByRole("dialog", { name: "Delete Staff permanently?" }))
      .toBeVisible();
  });

  it("asks before deleting, as Delete permanently, and says it can't be undone", async () => {
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("button", { name: "Actions for Staff" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();

    const dialog = screen.getByRole("dialog", { name: "Delete Staff permanently?" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByText("This can't be undone.")).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Delete permanently" })).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    // nothing about the Trash, which Roles don't have
    expect(dialog.getByText(/trash/i).elements()).toHaveLength(0);
    // a confirmation is answered, not closed: no ×
    expect(dialog.getByRole("button", { name: "Close" }).elements()).toHaveLength(0);
  });

  it("deletes permanently with a plain toast: no Undo, nothing to restore", async () => {
    deleteResult = { type: "success", status: 200, data: {} };
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("button", { name: "Actions for Staff" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen
      .getByRole("dialog", { name: "Delete Staff permanently?" })
      .getByRole("button", { name: "Delete permanently" })
      .click();

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Staff deleted"));
    // one argument: no action, no duration for an Undo
    expect(toast.success.mock.calls[0]).toHaveLength(1);
  });

  it("keeps the dialog open with the count of users when the role is still held", async () => {
    const message = "3 users hold this role. Remove it from them first.";
    deleteResult = { type: "failure", status: 409, data: { error: message, code: "ROLE_IN_USE" } };
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("button", { name: "Actions for Staff" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    const dialog = screen.getByRole("dialog", { name: "Delete Staff permanently?" });
    await dialog.getByRole("button", { name: "Delete permanently" }).click();

    await expect.element(dialog.getByRole("alert")).toBeVisible();
    expect(dialog.getByRole("alert").element().textContent).toContain(message);
    await expect
      .element(dialog.getByRole("link", { name: "Go to Users" }))
      .toHaveAttribute("href", "/master/users");
    await expect.element(dialog).toBeVisible();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it("clears an earlier refusal when the dialog is opened for another Role", async () => {
    deleteResult = {
      type: "failure",
      status: 409,
      data: { error: "1 user holds this role. Remove it from them first.", code: "ROLE_IN_USE" }
    };
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("button", { name: "Actions for Staff" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen
      .getByRole("dialog", { name: "Delete Staff permanently?" })
      .getByRole("button", { name: "Delete permanently" })
      .click();
    await expect.element(screen.getByRole("alert")).toBeVisible();
    await screen.getByRole("button", { name: "Cancel" }).click();

    await screen.getByRole("button", { name: "Actions for Auditor" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await expect
      .element(screen.getByRole("dialog", { name: "Delete Auditor permanently?" }))
      .toBeVisible();
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
  });

  it("still toasts a delete that failed for another reason", async () => {
    deleteResult = { type: "failure", status: 500, data: { error: "Something went wrong." } };
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("button", { name: "Actions for Staff" }).click();
    await screen.getByRole("menuitem", { name: "Delete…" }).click();
    await screen.getByRole("dialog").getByRole("button", { name: "Delete permanently" }).click();

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Something went wrong."));
    expect(screen.getByRole("alert").elements()).toHaveLength(0);
  });

  it("tells an empty list, a search with no match and a failure apart", async () => {
    const empty = await render(Page, props("/master/roles", { items: [] }));
    await expect.element(empty.getByText("No roles yet")).toBeVisible();
    await expect.element(empty.getByText(/optionally scoped to one division/)).toBeVisible();
    await expect.element(empty.getByRole("link", { name: "New role" }).last()).toBeVisible();
    empty.unmount();

    const none = await render(Page, props("/master/roles?search=zzz", { items: [] }));
    await expect.element(none.getByText("No roles match")).toBeVisible();
    await expect
      .element(none.getByRole("link", { name: "Clear search and filters" }))
      .toHaveAttribute("href", "/master/roles");
    none.unmount();

    const failed = await render(Page, props("/master/roles", { failed: true }));
    await expect.element(failed.getByText("Could not load roles. Please try again.")).toBeVisible();
  });

  it("narrows to the roles of one status from the URL", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles?status=inactive,active"));

    await expect
      .element(screen.getByRole("link", { name: "Remove filter Status: Active, Inactive" }))
      .toBeVisible();
  });

  it("hides a column from View and keeps the sort in the headers", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));
    await expect.element(screen.getByRole("columnheader", { name: "Description" })).toBeVisible();

    await screen.getByRole("button", { name: /^View/ }).click();
    await screen.getByRole("checkbox", { name: "Description" }).click();

    await expect
      .element(screen.getByRole("columnheader", { name: "Description" }))
      .not.toBeInTheDocument();
  });
});

describe("a Role in the layer over the list (#303)", () => {
  const layer = () => document.querySelector<HTMLElement>("[data-record-layer]");
  const closed = () => expect.poll(layer).toBeNull();

  it("opens a row in view mode at its URL, and closes back to the list as it was", async () => {
    await browser.viewport(1280, 900);
    const listUrl = "/master/roles?search=a&status=active&sort=updatedAt&perPage=50";
    const screen = await render(Page, props(listUrl));

    await screen.getByRole("link", { name: "Staff" }).click();

    const dialog = screen.getByRole("dialog", { name: "Staff" });
    await expect.element(dialog).toBeVisible();
    expect(mockPage.url.pathname).toBe(`/master/roles/${staff.id}`);
    await expect.element(dialog.getByRole("heading", { name: "Staff" })).toHaveFocus();
    await expect.element(dialog.getByText("Every division")).toBeVisible();
    await expect.element(dialog.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect.element(dialog.getByRole("link", { name: "Delete…" })).toBeVisible();

    await dialog.getByRole("button", { name: "Close" }).click();
    await closed();
    expect(`${mockPage.url.pathname}${mockPage.url.search}`).toBe(listUrl);
  });

  it("explains a System Role's view and offers nothing to change", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("link", { name: "Administrator" }).click();

    const dialog = screen.getByRole("dialog", { name: /Administrator/ });
    await expect.element(dialog).toBeVisible();
    await expect
      .element(
        dialog.getByText(
          "This is a System Role. VMB depends on it, so it can't be edited or deleted."
        )
      )
      .toBeVisible();
    // the lock badge sits beside the name in the header too
    expect(dialog.element().querySelector("[data-slot=system-badge]")).not.toBeNull();
    expect(dialog.getByRole("link", { name: "Edit" }).elements()).toHaveLength(0);
    expect(dialog.getByRole("link", { name: "Delete…" }).elements()).toHaveLength(0);
  });

  it("names the Division a role is scoped to", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));
    preloadData.mockImplementation(async () => ({
      type: "loaded" as const,
      status: 200,
      data: {
        role: { ...staff, divisionId: "x", divisionName: "Warehouse" },
        permissions: ALL
      }
    }));

    await screen.getByRole("link", { name: "Staff" }).click();

    await expect
      .element(screen.getByRole("dialog", { name: "Staff" }).getByText("Warehouse"))
      .toBeVisible();
  });

  it("switches the same layer to edit at /edit, and New opens an empty one at /new", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("link", { name: "Staff" }).click();
    await screen.getByRole("dialog", { name: "Staff" }).getByRole("link", { name: "Edit" }).click();
    const edit = screen.getByRole("dialog", { name: "Edit Staff" });
    await expect.element(edit).toBeVisible();
    expect(mockPage.url.pathname).toBe(`/master/roles/${staff.id}/edit`);
    await expect.element(edit.getByRole("textbox", { name: "Name" })).toHaveValue("Staff");
    await expect.element(edit.getByText("No changes yet")).toBeVisible();
    await userEvent.type(edit.getByRole("textbox", { name: "Name" }), " Lead");
    await expect.element(edit.getByText("Unsaved changes")).toBeVisible();
    await userEvent.click(edit.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await closed();

    await screen.getByRole("link", { name: "New role" }).click();
    const fresh = screen.getByRole("dialog", { name: "New role" });
    await expect.element(fresh).toBeVisible();
    expect(mockPage.url.pathname).toBe("/master/roles/new");
    await expect.element(fresh.getByRole("textbox", { name: "Name" })).toHaveValue("");
    await expect.element(fresh.getByText("Not saved yet")).toBeVisible();
  });

  it("deletes from the layer only after asking, then closes it with no Undo", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));
    await screen.getByRole("link", { name: "Staff" }).click();

    await screen
      .getByRole("dialog", { name: "Staff" })
      .getByRole("link", { name: "Delete…" })
      .click();
    const ask = screen.getByRole("dialog", { name: "Delete Staff permanently?" });
    await expect.element(ask.getByText("This can't be undone.")).toBeVisible();

    deleteResult = { type: "success", status: 200, data: {} };
    await ask.getByRole("button", { name: "Delete permanently" }).click();

    await closed();
    expect(mockPage.url.pathname).toBe("/master/roles");
    expect(toast.success).toHaveBeenCalledWith("Staff deleted");
    expect(toast.success.mock.calls[0]).toHaveLength(1);
  });

  it("has no axe violations in view and in edit", async () => {
    await browser.viewport(1280, 900);
    const screen = await render(Page, props("/master/roles"));

    await screen.getByRole("link", { name: "Staff" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Staff" })).toBeVisible();
    // contrast is measured once the layer has faded in: mid-fade its text is fainter than it ends
    await Promise.all(
      layer()!
        .getAnimations()
        .map((animation) => animation.finished)
    );
    expect(await axeViolations(document.body)).toEqual([]);

    await screen.getByRole("dialog", { name: "Staff" }).getByRole("link", { name: "Edit" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Edit Staff" })).toBeVisible();
    await Promise.all(
      layer()!
        .getAnimations()
        .map((animation) => animation.finished)
    );
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
