import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

const mockPage = { url: new URL("http://localhost/master/divisions") };
const goto = vi.fn();
vi.mock("$app/state", () => ({ page: mockPage }));
vi.mock("$app/navigation", () => ({ goto: (...args: unknown[]) => goto(...args) }));

const { render } = await import("vitest-browser-svelte");
const { default: ListSearch } = await import("./ListSearch.svelte");

const props = { base: "/master/divisions", label: "Search divisions" } as const;

afterEach(() => goto.mockReset());

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
});
