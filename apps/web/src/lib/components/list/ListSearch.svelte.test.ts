import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the field's width and font need it.
import "../../../app.css";

const mockPage = { url: new URL("http://localhost/master/divisions") };
const goto = vi.fn();
vi.mock("$app/state", () => ({ page: mockPage }));
vi.mock("$app/navigation", () => ({ goto: (...args: unknown[]) => goto(...args) }));

const { render } = await import("vitest-browser-svelte");
const { default: ListSearch } = await import("./ListSearch.svelte");

const props = { base: "/master/divisions", label: "Search divisions" } as const;

// `goto` resolves when the navigation settles; tests hold it open to see the pending state
function pendingGoto() {
  let settle: () => void = () => {};
  goto.mockImplementation(() => new Promise<void>((resolve) => (settle = resolve)));
  return { settle: () => settle() };
}

afterEach(async () => {
  goto.mockReset();
  await browser.viewport(414, 896);
});

describe("ListSearch", () => {
  it("follows the typing once it pauses, keeping focus, as one new history entry", async () => {
    mockPage.url = new URL("http://localhost/master/divisions?status=active&page=3");
    const screen = await render(ListSearch, props);

    await screen.getByRole("searchbox").fill("ops");
    expect(goto).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
    expect(goto).toHaveBeenCalledWith("/master/divisions?status=active&search=ops", {
      keepFocus: true,
      noScroll: true,
      replaceState: false
    });
  });

  it("replaces the entry while refining a search already in the URL", async () => {
    mockPage.url = new URL("http://localhost/master/divisions?search=op");
    const screen = await render(ListSearch, props);

    await expect.element(screen.getByRole("searchbox")).toHaveValue("op");
    await screen.getByRole("searchbox").fill("ops");

    await vi.waitFor(() =>
      expect(goto).toHaveBeenCalledWith("/master/divisions?search=ops", {
        keepFocus: true,
        noScroll: true,
        replaceState: true
      })
    );
  });

  it("searches at once on Enter, and works as a plain GET form without JavaScript", async () => {
    mockPage.url = new URL("http://localhost/master/divisions?status=active&sort=code");
    const screen = await render(ListSearch, props);

    const form = screen.container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("GET");
    expect(
      [...(form?.querySelectorAll<HTMLInputElement>("input[type=hidden]") ?? [])].map(
        (input) => `${input.name}=${input.value}`
      )
    ).toEqual(["status=active", "sort=code"]);

    await screen.getByRole("searchbox").click();
    await userEvent.keyboard("ops{Enter}");
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith(
      "/master/divisions?status=active&sort=code&search=ops",
      expect.objectContaining({ keepFocus: true })
    );
  });

  it("carries a parameter the URL repeats without breaking", async () => {
    mockPage.url = new URL("http://localhost/master/divisions?status=active&status=inactive");
    const screen = await render(ListSearch, props);

    expect(
      [...screen.container.querySelectorAll<HTMLInputElement>("input[type=hidden]")].map(
        (input) => `${input.name}=${input.value}`
      )
    ).toEqual(["status=active", "status=inactive"]);
  });

  it("focuses on / from anywhere outside a field", async () => {
    mockPage.url = new URL("http://localhost/master/divisions");
    const screen = await render(ListSearch, props);

    await userEvent.keyboard("/");
    await expect.element(screen.getByRole("searchbox")).toHaveFocus();
    await expect.element(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("shows the / hint while the field is empty and unfocused, and our own × once there is text", async () => {
    mockPage.url = new URL("http://localhost/master/divisions");
    await browser.viewport(1024, 800);
    const screen = await render(ListSearch, props);
    const box = screen.getByRole("searchbox");

    await expect.element(screen.getByText("/", { exact: true })).toBeVisible();
    await box.click();
    await expect.element(screen.getByText("/", { exact: true })).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Clear the search" }))
      .not.toBeInTheDocument();

    await box.fill("ops");
    await expect.element(screen.getByRole("button", { name: "Clear the search" })).toBeVisible();
  });

  it("clears the text with the ×, searches for nothing and keeps focus in the field", async () => {
    mockPage.url = new URL("http://localhost/master/divisions?search=ops&status=active");
    const screen = await render(ListSearch, props);

    await screen.getByRole("button", { name: "Clear the search" }).click();

    await expect.element(screen.getByRole("searchbox")).toHaveValue("");
    await expect.element(screen.getByRole("searchbox")).toHaveFocus();
    expect(goto).toHaveBeenCalledWith("/master/divisions?status=active", expect.anything());
  });

  it("clears the text on the first Esc, then leaves the field on the second", async () => {
    mockPage.url = new URL("http://localhost/master/divisions?search=ops");
    const screen = await render(ListSearch, props);
    const box = screen.getByRole("searchbox");

    await box.click();
    await userEvent.keyboard("{Escape}");
    await expect.element(box).toHaveValue("");
    await expect.element(box).toHaveFocus();
    expect(goto).toHaveBeenCalledWith("/master/divisions", expect.anything());

    await userEvent.keyboard("{Escape}");
    await expect.element(box).not.toHaveFocus();
  });

  it("swaps the magnifier for a spinner and marks the field busy while a search is pending", async () => {
    mockPage.url = new URL("http://localhost/master/divisions");
    const navigation = pendingGoto();
    const screen = await render(ListSearch, props);
    const box = screen.getByRole("searchbox");
    const spinner = () => screen.container.querySelector("svg.animate-spin");

    await expect.element(box).toHaveAttribute("aria-busy", "false");
    expect(spinner()).toBeNull();

    await box.fill("ops");
    // busy from the first keystroke, through the pause and the navigation
    await expect.element(box).toHaveAttribute("aria-busy", "true");
    expect(spinner()).not.toBeNull();
    await vi.waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
    await expect.element(box).toHaveAttribute("aria-busy", "true");

    navigation.settle();
    await expect.element(box).toHaveAttribute("aria-busy", "false");
    expect(spinner()).toBeNull();
  });

  it("names the matched fields, and shortens the placeholder when the field would cut it off", async () => {
    mockPage.url = new URL("http://localhost/master/divisions");
    const long = "Search name, code or description";
    const screen = await render(ListSearch, {
      ...props,
      placeholder: long,
      shortPlaceholder: "Search divisions",
      class: "w-96"
    });
    await expect.element(screen.getByRole("searchbox")).toHaveAttribute("placeholder", long);
    screen.unmount();

    const narrow = await render(ListSearch, {
      ...props,
      placeholder: long,
      shortPlaceholder: "Search divisions",
      class: "w-40"
    });
    await expect
      .element(narrow.getByRole("searchbox"))
      .toHaveAttribute("placeholder", "Search divisions");
  });
});
