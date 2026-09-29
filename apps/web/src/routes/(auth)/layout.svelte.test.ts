import { createRawSnippet } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";

type Place = { route: { id: string } } | null;
type Navigation = { from: Place; to: Place; complete: Promise<void> };

// SvelteKit's navigation hooks, captured so a test can play a navigation.
const hooks = vi.hoisted(() => ({
  onNavigate: undefined as ((navigation: Navigation) => Promise<void> | void) | undefined,
  afterNavigate: undefined as ((navigation: Navigation) => void) | undefined
}));
vi.mock("$app/navigation", () => ({
  onNavigate: (callback: typeof hooks.onNavigate) => (hooks.onNavigate = callback),
  afterNavigate: (callback: typeof hooks.afterNavigate) => (hooks.afterNavigate = callback)
}));
vi.mock("$app/paths", () => ({
  resolve: (path: string) => path
}));
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/login") }
}));

const { render } = await import("vitest-browser-svelte");
const { default: Layout } = await import("./+layout.svelte");

const login: Place = { route: { id: "/(auth)/login" } };
const activate: Place = { route: { id: "/(auth)/activate" } };
const home: Place = { route: { id: "/" } };

const card = (heading: string) =>
  createRawSnippet(() => ({
    render: () => `<h1 id="auth-heading" tabindex="-1">${heading}</h1>`
  }));

const navigation = (from: Place, to: Place): Navigation => ({
  from,
  to,
  complete: Promise.resolve()
});

// The real media query, emulated in Chromium (see MotionDemo's test).
async function emulateReducedMotion(value: "reduce" | "no-preference") {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value }]
  });
}

beforeEach(() => {
  hooks.onNavigate = undefined;
  hooks.afterNavigate = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await emulateReducedMotion("no-preference");
});

describe("auth layout", () => {
  it("keeps the frame and artwork mounted while the card changes", async () => {
    const screen = await render(Layout, { children: card("Log in") });
    const sky = screen.container.querySelector(".etched-sky");
    const scene = screen.container.querySelector("main")?.parentElement;
    expect(sky).not.toBeNull();

    await screen.rerender({ children: card("Set your password") });

    await expect.element(screen.getByRole("heading", { name: "Set your password" })).toBeVisible();
    expect(screen.container.querySelector(".etched-sky")).toBe(sky);
    expect(screen.container.querySelector("main")?.parentElement).toBe(scene);
    expect(screen.container.querySelectorAll("main")).toHaveLength(1);
  });

  it("shows a copyright footer with the current year", async () => {
    const screen = await render(Layout, { children: card("Log in") });

    await expect
      .element(
        screen
          .getByRole("contentinfo")
          .getByText(`© ${new Date().getFullYear()} PT. Vifiera Minova Bersaudara`)
      )
      .toBeVisible();
  });

  it("offers the support team's address and the developer credit in the footer", async () => {
    const screen = await render(Layout, { children: card("Log in") });
    const footer = screen.getByRole("contentinfo");

    await expect
      .element(footer.getByRole("link", { name: "support@vmblogistics.id", exact: true }))
      .toHaveAttribute("href", "mailto:support@vmblogistics.id");
    await expect
      .element(footer.getByRole("link", { name: "ubeann", exact: true }))
      .toHaveAttribute("href", "https://github.com/ubeann");
    expect(footer.element().textContent).toMatch(/Support team:\s+support@vmblogistics\.id/);
  });

  it("labels the card by its heading", async () => {
    const screen = await render(Layout, { children: card("Log in") });

    await expect.element(screen.getByRole("region", { name: "Log in" })).toBeVisible();
  });

  describe("after a move between auth pages", () => {
    it("focuses the new card heading", async () => {
      const screen = await render(Layout, { children: card("Set your password") });

      hooks.afterNavigate?.(navigation(login, activate));

      await expect
        .element(screen.getByRole("heading", { name: "Set your password" }))
        .toHaveFocus();
    });

    it("leaves focus alone on the first load", async () => {
      const screen = await render(Layout, { children: card("Log in") });

      hooks.afterNavigate?.(navigation(null, login));

      await expect.element(screen.getByRole("heading", { name: "Log in" })).not.toHaveFocus();
    });

    it("leaves focus alone when the page does not change", async () => {
      const screen = await render(Layout, { children: card("Log in") });

      hooks.afterNavigate?.(navigation(login, login));

      await expect.element(screen.getByRole("heading", { name: "Log in" })).not.toHaveFocus();
    });
  });

  describe("view transition", () => {
    function stubTransition() {
      const callbacks: Array<() => Promise<void>> = [];
      const settled = Promise.resolve();
      vi.spyOn(document, "startViewTransition").mockImplementation(((
        update: () => Promise<void>
      ) => {
        callbacks.push(update);
        return { ready: settled, finished: settled, updateCallbackDone: settled };
      }) as never);
      return callbacks;
    }

    it("wraps a move between auth pages and releases SvelteKit once the old card is captured", async () => {
      await render(Layout, { children: card("Log in") });
      const callbacks = stubTransition();

      const released = hooks.onNavigate?.(navigation(login, activate));
      expect(released).toBeInstanceOf(Promise);
      expect(callbacks).toHaveLength(1);

      const running = callbacks[0]!();
      await released;
      await running;
    });

    it("does not wrap a move out of the auth pages", async () => {
      await render(Layout, { children: card("Log in") });
      const callbacks = stubTransition();

      expect(hooks.onNavigate?.(navigation(login, home))).toBeUndefined();
      expect(callbacks).toHaveLength(0);
    });

    it("does not run when the user prefers reduced motion", async () => {
      await emulateReducedMotion("reduce");
      await render(Layout, { children: card("Log in") });
      const callbacks = stubTransition();

      expect(hooks.onNavigate?.(navigation(login, activate))).toBeUndefined();
      expect(callbacks).toHaveLength(0);
    });
  });
});
