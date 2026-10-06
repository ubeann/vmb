import { DivisionListQuerySchema, type Division } from "@vmb/types";
import { describe, expect, it } from "vitest";

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
  createdAt: null,
  updatedAt: null,
  deletedAt: null
};

const trashed: Division = {
  ...division,
  id: "d1000000-0000-4000-8000-000000000002",
  name: "Retired",
  code: "RET",
  description: null,
  isActive: false,
  deletedAt: "2026-01-06T01:00:00.000Z"
};

describe("divisions list", () => {
  it("renders the filters, rows and pagination", async () => {
    const data = {
      user: null,
      division: null,
      permissions: [],
      sidebarOpen: true,
      query: DivisionListQuerySchema.parse({ search: "ops" }),
      divisions: {
        items: [division, trashed],
        total: 12,
        page: 1,
        perPage: 10
      }
    };

    const screen = await render(Page, { data, form: null });

    await expect.element(screen.getByRole("heading", { name: "Divisions" })).toBeVisible();
    await expect.element(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("ops");
    await expect
      .element(screen.getByRole("link", { name: /Operations/ }))
      .toHaveAttribute("href", "/master/divisions/d1000000-0000-4000-8000-000000000001");

    await expect.element(screen.getByText("OPS")).toBeVisible();
    await expect.element(screen.getByText("Fleet and day-to-day operations")).toBeVisible();
    await expect.element(screen.getByText("No description")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Restore" })).toBeVisible();

    await expect.element(screen.getByText("Page 1 of 2 (12 total)")).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Next" })).toBeVisible();
  });

  it("shows the empty state and an API failure", async () => {
    const empty = await render(Page, {
      data: {
        user: null,
        division: null,
        permissions: [],
        sidebarOpen: true,
        query: DivisionListQuerySchema.parse({}),
        divisions: { items: [], total: 0, page: 1, perPage: 10 }
      },
      form: null
    });
    await expect.element(empty.getByText("No divisions found.")).toBeVisible();

    const failed = await render(Page, {
      data: {
        user: null,
        division: null,
        permissions: [],
        sidebarOpen: true,
        query: DivisionListQuerySchema.parse({}),
        divisions: null
      },
      form: null
    });
    await expect
      .element(failed.getByText("Could not load divisions. Please try again."))
      .toBeVisible();
  });

  it("shows an action's error on the page", async () => {
    const screen = await render(Page, {
      data: {
        user: null,
        division: null,
        permissions: [],
        sidebarOpen: true,
        query: DivisionListQuerySchema.parse({}),
        divisions: { items: [division], total: 1, page: 1, perPage: 10 }
      },
      form: { error: "A division with that name already exists." }
    });

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("A division with that name already exists.");
  });
});
