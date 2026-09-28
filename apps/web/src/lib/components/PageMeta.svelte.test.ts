import { describe, expect, it, vi } from "vitest";

vi.mock("$app/state", () => ({
  page: { url: new URL("https://vmb.example/login?logged_out=true") }
}));

const { render } = await import("vitest-browser-svelte");
const { default: PageMeta } = await import("./PageMeta.svelte");

const meta = (key: string) =>
  document.head
    .querySelector(`meta[name="${key}"], meta[property="${key}"]`)
    ?.getAttribute("content");

describe("PageMeta", () => {
  it("sets the tab title, description and link-preview tags", async () => {
    render(PageMeta, { title: "Log in", description: "Sign in to VMB." });

    await expect.poll(() => document.title).toBe("Log in — VMB");
    expect(meta("description")).toBe("Sign in to VMB.");
    expect(meta("og:title")).toBe("Log in — VMB");
    expect(meta("og:url")).toBe("https://vmb.example/login");
    expect(meta("og:image")).toBe("https://vmb.example/og-image.jpg");
  });
});
