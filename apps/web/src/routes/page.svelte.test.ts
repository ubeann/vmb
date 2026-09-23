import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

describe("home page", () => {
  it("shows the API health status from page data", async () => {
    const screen = await render(Page, {
      data: {
        user: null,
        health: { status: "ok", db: "connected", timestamp: "2026-01-01T00:00:00.000Z" }
      }
    });

    await expect.element(screen.getByRole("heading", { name: "VMB" })).toBeVisible();
    await expect.element(screen.getByText("ok", { exact: true })).toBeVisible();
    await expect.element(screen.getByText(/db: connected/)).toBeVisible();
  });

  it("shows the error status when the API is unreachable", async () => {
    const screen = await render(Page, {
      data: {
        user: null,
        health: { status: "error", db: "unreachable", timestamp: "2026-01-01T00:00:00.000Z" }
      }
    });

    await expect.element(screen.getByText("error", { exact: true })).toBeVisible();
    await expect.element(screen.getByText(/db: unreachable/)).toBeVisible();
  });
});
