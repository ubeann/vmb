import { describe, expect, it, vi } from "vitest";

const mockPage: {
  url: URL;
  status: number;
  error: { message: string; errorId?: string } | null;
  data: { user: { id: string } | null };
} = {
  url: new URL("http://localhost/nowhere"),
  status: 404,
  error: { message: "Not Found" },
  data: { user: null }
};

vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));
vi.mock("$app/state", () => ({
  page: mockPage
}));

const { render } = await import("vitest-browser-svelte");
const { default: ErrorPage } = await import("./+error.svelte");

describe("error page", () => {
  it("names a missing page and offers a way to log in, when signed out", async () => {
    mockPage.status = 404;
    mockPage.error = { message: "Not Found" };
    mockPage.data = { user: null };

    const screen = await render(ErrorPage);

    await expect.element(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect.element(screen.getByText("This page doesn't exist or has moved.")).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Go to login" })).toBeVisible();
    await expect.poll(() => document.title).toBe("Page not found — VMB");
    expect(screen.getByText("Not Found").elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Try again" }).elements()).toHaveLength(0);
  });

  it("gives a 500 its own copy, never the raw error message", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error", errorId: "3f9a1c2e" };
    mockPage.data = { user: null };

    const screen = await render(ErrorPage);

    await expect
      .element(screen.getByRole("heading", { name: "Something went wrong" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Try refreshing the page, or come back in a few minutes."))
      .toBeVisible();
    await expect.poll(() => document.title).toBe("Something went wrong — VMB");
    expect(screen.getByText("Internal Error").elements()).toHaveLength(0);
    await expect
      .element(screen.getByRole("link", { name: "Try again" }))
      .toHaveAttribute("href", "/nowhere");
    await expect.element(screen.getByText("3f9a1c2e")).toBeVisible();
    await expect
      .element(screen.getByRole("main").getByRole("link", { name: "support@vmblogistics.id" }))
      .toHaveAttribute("href", "mailto:support@vmblogistics.id?subject=VMB%20error%203f9a1c2e");
  });

  it("names a locked page and points to an administrator", async () => {
    mockPage.status = 403;
    mockPage.error = { message: "Forbidden" };
    mockPage.data = { user: { id: "user-1" } };

    const screen = await render(ErrorPage);

    await expect
      .element(screen.getByRole("heading", { name: "No access to this page" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Ask an administrator if you need access.", { exact: false }))
      .toBeVisible();
    expect(screen.getByText("Forbidden").elements()).toHaveLength(0);
  });

  it("keeps the vignette out of the accessibility tree", async () => {
    mockPage.status = 404;
    mockPage.error = { message: "Not Found" };
    mockPage.data = { user: null };

    const screen = await render(ErrorPage);

    const vignette = screen.container.querySelector(".etched-vignette");
    expect(vignette?.getAttribute("aria-hidden")).toBe("true");
  });

  it("offers home instead of login when the visitor has a session", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error" };
    mockPage.data = { user: { id: "user-1" } };

    const screen = await render(ErrorPage);

    await expect.element(screen.getByRole("link", { name: "Back to VMB" })).toBeVisible();
  });
});
