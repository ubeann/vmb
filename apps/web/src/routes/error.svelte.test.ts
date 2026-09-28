import { describe, expect, it, vi } from "vitest";

const mockPage: { url: URL; status: number; error: { message: string } | null } = {
  url: new URL("http://localhost/nowhere"),
  status: 404,
  error: { message: "Not Found" }
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
  it("names a missing page and links back home", async () => {
    mockPage.status = 404;

    const screen = await render(ErrorPage);

    await expect.element(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "Back to VMB" })).toBeVisible();
    await expect.poll(() => document.title).toBe("Page not found — VMB");
    expect(screen.getByText("Not Found").elements()).toHaveLength(0);
  });

  it("gives any other failure a generic title", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error" };

    const screen = await render(ErrorPage);

    await expect
      .element(screen.getByRole("heading", { name: "Something went wrong" }))
      .toBeVisible();
    await expect.element(screen.getByText("Internal Error")).toBeVisible();
    await expect.poll(() => document.title).toBe("Something went wrong — VMB");
  });
});
