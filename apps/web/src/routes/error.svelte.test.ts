import { describe, expect, it, vi } from "vitest";

const mockPage: {
  url: URL;
  status: number;
  error: { message: string; errorId?: string; occurredAt?: string } | null;
  data: { user: { id: string } | null };
} = {
  url: new URL("http://localhost/nowhere"),
  status: 404,
  error: { message: "Not Found" },
  data: { user: null }
};

vi.mock("$app/paths", () => ({
  resolve: (path: string) => (path.startsWith("/") ? path : `/${path}`)
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
    await expect.element(screen.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect.poll(() => document.title).toBe("Page not found — VMB");
    expect(screen.getByText("Not Found").elements()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Try again" }).elements()).toHaveLength(0);
  });

  it("gives a 500 its own copy, never the raw error message", async () => {
    mockPage.status = 500;
    mockPage.error = {
      message: "Internal Error",
      errorId: "3f9a1c2e",
      occurredAt: "2026-09-29T09:22:41.000Z"
    };
    mockPage.data = { user: null };

    const screen = await render(ErrorPage);

    await expect
      .element(screen.getByRole("heading", { name: "Unable to load this page" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Try again, or come back in a few minutes."))
      .toBeVisible();
    await expect.poll(() => document.title).toBe("Unable to load this page — VMB");
    expect(screen.getByText("Internal Error").elements()).toHaveLength(0);
    await expect
      .element(screen.getByRole("link", { name: "Try again" }))
      .toHaveAttribute("href", "/nowhere");
    await expect.element(screen.getByText("3f9a1c2e")).toBeVisible();
    const mailto = screen
      .getByRole("main")
      .getByRole("link", { name: "support@vmblogistics.id" })
      .element()
      .getAttribute("href");
    expect(mailto).toMatch(
      /^mailto:support@vmblogistics\.id\?subject=VMB%20error%203f9a1c2e&body=/
    );
    expect(decodeURIComponent(mailto?.split("&body=")[1] ?? "")).toContain("Page: /nowhere");
  });

  it("copies the reference and announces it", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error", errorId: "3f9a1c2e" };
    mockPage.data = { user: null };
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    const screen = await render(ErrorPage);
    const copy = screen.getByRole("button", { name: "Copy reference" });
    await expect.element(copy).toHaveTextContent("Copy");
    await expect
      .element(screen.getByRole("group", { name: "Reference" }).getByText("3f9a1c2e"))
      .toBeVisible();
    await copy.click();

    expect(writeText).toHaveBeenCalledWith("3f9a1c2e");
    await expect.element(screen.getByRole("button", { name: "Copied" })).toBeVisible();
    await expect.element(screen.getByText("Reference copied")).toBeInTheDocument();
    writeText.mockRestore();
  });

  it("goes back to Copy after two seconds, so it can be copied again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      mockPage.status = 500;
      mockPage.error = { message: "Internal Error", errorId: "3f9a1c2e" };
      mockPage.data = { user: null };
      vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

      const screen = await render(ErrorPage);
      await screen.getByRole("button", { name: "Copy reference" }).click();
      await expect.element(screen.getByRole("button", { name: "Copied" })).toBeVisible();

      vi.advanceTimersByTime(2000);

      await expect.element(screen.getByRole("button", { name: "Copy reference" })).toBeVisible();
      expect(screen.getByText("Reference copied").elements()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("selects the reference and names the shortcut when the clipboard is blocked", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error", errorId: "3f9a1c2e" };
    mockPage.data = { user: null };
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));

    const screen = await render(ErrorPage);
    await screen.getByRole("button", { name: "Copy reference" }).click();

    const shortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘C" : "Ctrl+C";
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent(`Press ${shortcut} to copy the reference.`);
    expect(window.getSelection()?.toString()).toBe("3f9a1c2e");
    expect(screen.getByRole("button", { name: "Copied" }).elements()).toHaveLength(0);
    writeText.mockRestore();
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
      .element(screen.getByText("Ask an administrator for access.", { exact: false }))
      .toBeVisible();
    expect(screen.getByText("Forbidden").elements()).toHaveLength(0);
  });

  it("offers the dashboard instead of logging in when the visitor has a session", async () => {
    mockPage.status = 500;
    mockPage.error = { message: "Internal Error" };
    mockPage.data = { user: { id: "user-1" } };

    const screen = await render(ErrorPage);

    await expect.element(screen.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Log in" }).elements()).toHaveLength(0);
  });
});
