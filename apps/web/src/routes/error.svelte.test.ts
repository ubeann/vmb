import { describe, expect, it, vi } from "vitest";

const mockPage: {
  url: URL;
  status: number;
  error: { message: string } | null;
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
  });

  it("gives a 500 its own copy, never the raw error message", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error" };
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
  });

  it("offers home instead of login when the visitor has a session", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error" };
    mockPage.data = { user: { id: "user-1" } };

    const screen = await render(ErrorPage);

    await expect.element(screen.getByRole("link", { name: "Back to VMB" })).toBeVisible();
  });
});
