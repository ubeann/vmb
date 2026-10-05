import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the sidebar's responsive
// switch and axe's colour reads are styles.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

const mockPage = { url: new URL("http://localhost/") };

vi.mock("$app/paths", () => ({
  resolve: (path: string, params: Record<string, string> = {}) =>
    Object.entries(params).reduce((out, [key, value]) => out.replace(`[${key}]`, value), path)
}));
vi.mock("$app/state", () => ({ page: mockPage }));

const { render } = await import("vitest-browser-svelte");
const { modeStorageKey, resetMode } = await import("mode-watcher");
const { default: AppShell } = await import("./AppShell.svelte");

const body = createRawSnippet(() => ({ render: () => "<h1>Page body</h1>" }));

const user = { id: "u-1", name: "Siti Rahma", email: "siti@vmblogistics.id" };
const division = { name: "Warehouse", iconName: "heroicon-o-building-storefront" };

const props = (overrides: Record<string, unknown> = {}) => ({
  user,
  division,
  sidebarOpen: true,
  children: body,
  ...overrides
});

const desktop = () => browser.viewport(1280, 800);
const phone = () => browser.viewport(390, 844);

afterEach(() => {
  resetMode();
  mockPage.url = new URL("http://localhost/");
  document.documentElement.classList.remove("dark");
});

describe("AppShell", () => {
  it("lists the screens in the main navigation and marks the current one", async () => {
    await desktop();
    mockPage.url = new URL("http://localhost/master/users/new");
    const screen = await render(AppShell, props());

    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Dashboard", "Divisions", "Roles", "Users"]) {
      await expect.element(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect
      .element(nav.getByRole("link", { name: "Users" }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(nav.getByRole("link", { name: "Dashboard" }))
      .not.toHaveAttribute("aria-current");
  });

  it("washes the current page green and the hovered one warm in light mode, not blue", async () => {
    await desktop();
    mockPage.url = new URL("http://localhost/master/users");
    const screen = await render(AppShell, props());

    // Reads the painted colour as sRGB through a canvas, whatever space the CSS uses.
    const rgb = (el: Element) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.fillStyle = "#000";
      ctx.fillStyle = getComputedStyle(el).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return { r: r!, g: g!, b: b! };
    };

    const current = (await screen.getByRole("link", { name: "Users" }).element()).closest(
      "[data-slot='sidebar-menu-button']"
    )!;
    const { r, g, b } = rgb(current);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);

    await userEvent.hover(screen.getByRole("link", { name: "Roles" }));
    const hovered = (await screen.getByRole("link", { name: "Roles" }).element()).closest(
      "[data-slot='sidebar-menu-button']"
    )!;
    await expect.poll(() => rgb(hovered).r).toBeGreaterThan(rgb(hovered).b);

    document.documentElement.classList.add("dark");
    const dark = rgb(current);
    expect(dark.b).toBeGreaterThan(dark.g);
  });

  it("gives the sidebar rows room, and keeps their rhythm as a square when it collapses", async () => {
    await desktop();
    for (const [sidebarOpen, size] of [
      [true, 40],
      [false, 32]
    ] as const) {
      const screen = await render(AppShell, props({ sidebarOpen }));
      const rows = ["Divisions", "Roles"].map((name) =>
        screen.getByRole("link", { name }).element().getBoundingClientRect()
      );

      expect(rows[0]!.height).toBe(size);
      if (!sidebarOpen) expect(rows[0]!.width).toBe(size);
      // Open or collapsed, the rows sit 44px apart, so nothing shifts as the sidebar narrows.
      expect(rows[1]!.top - rows[0]!.top).toBe(44);
      await screen.unmount();
    }
  });

  it("makes the theme choice a comfortable height on desktop", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    const group = screen.getByRole("menuitemradio", { name: "Light" }).element().parentElement!;
    await expect.poll(() => group.getBoundingClientRect().height).toBe(40);
  });

  it("opens the user's menu with their identity and division", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    await expect.element(screen.getByText("siti@vmblogistics.id")).toBeVisible();
    await expect.element(screen.getByText("Division", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("Warehouse").last()).toBeVisible();
  });

  it("says so when the user has no division", async () => {
    await desktop();
    const screen = await render(AppShell, props({ division: null }));

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    await expect.element(screen.getByText("No division").last()).toBeVisible();
  });

  it("signs out with a form post from the user's menu", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    const logOut = screen.getByRole("menuitem", { name: "Log out" });
    await expect.element(logOut).toBeVisible();
    const form = logOut.element().closest("form");
    expect(form?.method).toBe("post");
    expect(form?.getAttribute("action")).toBe("/logout");
  });

  it("chooses the theme from the user's menu without closing it", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();
    await expect
      .element(screen.getByRole("menuitemradio", { name: "System" }))
      .toHaveAttribute("aria-checked", "true");

    await screen.getByRole("menuitemradio", { name: "Dark" }).click();

    expect(localStorage.getItem(modeStorageKey.current)).toBe("dark");
    await expect
      .element(screen.getByRole("menuitemradio", { name: "Dark" }))
      .toHaveAttribute("aria-checked", "true");

    await screen.getByRole("menuitemradio", { name: "System" }).click();
    expect(localStorage.getItem(modeStorageKey.current)).toBe("system");
  });

  it("shows a pointer over the menu's actions", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();

    for (const target of [
      screen.getByRole("menuitem", { name: "Log out" }),
      screen.getByRole("menuitemradio", { name: "Dark" })
    ]) {
      expect(getComputedStyle(target.element()).cursor).toBe("pointer");
    }
  });

  it("rounds the account button into a circle on a phone and a roomy pill on desktop", async () => {
    await phone();
    const small = await render(AppShell, props());
    const circle = small.getByRole("button", { name: "Siti Rahma, account menu" }).element();
    const { width, height } = circle.getBoundingClientRect();

    expect(width).toBe(height);
    expect(parseFloat(getComputedStyle(circle).borderTopLeftRadius)).toBeGreaterThanOrEqual(
      height / 2
    );
    small.unmount();

    await desktop();
    const large = await render(AppShell, props());
    const pill = large.getByRole("button", { name: "Siti Rahma, account menu" }).element();

    expect(pill.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
  });

  it("underlines the top bar on a phone, where no panel edge parts it from the page", async () => {
    await phone();
    const small = await render(AppShell, props());

    expect(getComputedStyle(small.getByRole("banner").element()).borderBottomColor).not.toBe(
      "rgba(0, 0, 0, 0)"
    );
    small.unmount();

    await desktop();
    const large = await render(AppShell, props());

    expect(getComputedStyle(large.getByRole("banner").element()).borderBottomColor).toBe(
      "rgba(0, 0, 0, 0)"
    );
  });

  it("puts the logo at the top of the sidebar, and in the menu sheet on a phone", async () => {
    await phone();
    const small = await render(AppShell, props());
    const logo = (screen: typeof small) =>
      screen.getByRole("link", { name: "VMB, go to the dashboard" });

    await expect.element(small.getByRole("banner").getByRole("link")).not.toBeInTheDocument();
    await expect.element(logo(small)).not.toBeInTheDocument();
    await small.getByRole("button", { name: "Menu" }).click();
    await expect.element(logo(small)).toBeVisible();
    small.unmount();

    await desktop();
    const large = await render(AppShell, props());

    await expect.element(large.getByRole("banner").getByRole("link")).not.toBeInTheDocument();
    await expect.element(logo(large)).toBeVisible();
    expect(logo(large).element().getBoundingClientRect().left).toBeLessThan(64);
  });

  it("lines the sheet's logo up with the menu below it", async () => {
    await phone();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Menu" }).click();

    const logo = screen.getByRole("link", { name: "VMB, go to the dashboard" }).element();
    const icon = screen.getByRole("link", { name: "Dashboard" }).element().querySelector("svg")!;
    await expect
      .poll(() => logo.querySelector("svg")!.getBoundingClientRect().left)
      .toBeCloseTo(icon.getBoundingClientRect().left, 0);
  });

  it("dims the page behind the phone menu without blurring it", async () => {
    await phone();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Menu" }).click();

    const scrim = getComputedStyle(document.querySelector("[data-slot='sheet-overlay']")!);
    expect(scrim.backdropFilter).toBe("none");
    expect(Number(/\/ ([\d.]+)\)/.exec(scrim.backgroundColor)?.[1])).toBeGreaterThanOrEqual(0.5);
  });

  describe("the phone menu", () => {
    const sheet = () => document.querySelector<HTMLElement>("[data-mobile='true']");
    const openMenu = async () => {
      await phone();
      const screen = await render(AppShell, props());
      await screen.getByRole("button", { name: "Menu" }).click();
      await expect.element(screen.getByRole("link", { name: "Divisions" })).toBeVisible();
      return screen;
    };
    const stroke = (from: [number, number], to: [number, number]) => {
      const target = sheet()!.querySelector<HTMLElement>("nav")!;
      const event = (type: string, [x, y]: [number, number]) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            pointerType: "touch",
            pointerId: 7,
            clientX: x,
            clientY: y,
            bubbles: true
          })
        );
      event("pointerdown", from);
      event("pointerup", to);
    };

    it("closes from a close button in the sheet", async () => {
      const screen = await openMenu();

      await screen.getByRole("button", { name: "Close menu" }).click();

      await expect.element(screen.getByRole("link", { name: "Divisions" })).not.toBeInTheDocument();
      await expect
        .element(screen.getByRole("button", { name: "Menu" }))
        .toHaveAttribute("aria-expanded", "false");
    });

    it("closes when a link in it is followed", async () => {
      const screen = await openMenu();
      const keepPage = (event: Event) => event.preventDefault();
      document.addEventListener("click", keepPage);

      await screen.getByRole("link", { name: "Dashboard" }).click();
      document.removeEventListener("click", keepPage);

      await expect.element(screen.getByRole("link", { name: "Divisions" })).not.toBeInTheDocument();
    });

    it("closes on a leftward flick, and ignores short or vertical strokes", async () => {
      const screen = await openMenu();

      stroke([200, 300], [180, 300]);
      stroke([200, 300], [100, 420]);
      await expect.element(screen.getByRole("link", { name: "Divisions" })).toBeVisible();

      stroke([220, 300], [90, 310]);
      await expect.element(screen.getByRole("link", { name: "Divisions" })).not.toBeInTheDocument();
    });

    it("is as wide as the sidebar, however wide the screen", async () => {
      const screen = await openMenu();
      const width = () => sheet()!.getBoundingClientRect().width;

      expect(width()).toBe(288);
      screen.unmount();

      await browser.viewport(320, 700);
      const narrow = await render(AppShell, props());
      await narrow.getByRole("button", { name: "Menu" }).click();
      await expect.element(narrow.getByRole("link", { name: "Divisions" })).toBeVisible();

      expect(width()).toBeCloseTo(272, 0);
    });

    it("locks the page behind it and draws no focus box round the sheet", async () => {
      await openMenu();

      expect(getComputedStyle(document.body).overflow).toBe("hidden");
      expect(getComputedStyle(sheet()!).outlineStyle).toBe("none");
    });
  });

  it("keeps wide page content from widening the page", async () => {
    const wide = createRawSnippet(() => ({
      render: () => '<div style="width: 2400px">wide</div>'
    }));
    const page = () => document.documentElement;

    for (const [name, size, open] of [
      ["a phone", phone, true],
      ["desktop, sidebar open", desktop, true],
      ["desktop, sidebar collapsed", desktop, false]
    ] as const) {
      await size();
      const screen = await render(AppShell, props({ children: wide, sidebarOpen: open }));

      expect(page().scrollWidth, name).toBeLessThanOrEqual(page().clientWidth);
      expect(
        document.querySelector("#main-content")!.scrollWidth,
        `${name}: the panel scrolls it`
      ).toBeGreaterThan(2000);
      screen.unmount();
    }
  });

  it("fits the panel inside the page on desktop", async () => {
    await desktop();
    await render(AppShell, props());

    const panel = document.querySelector("#main-content")!.getBoundingClientRect();
    expect(panel.right).toBeLessThanOrEqual(document.documentElement.clientWidth - 8);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth
    );
  });

  it("says whether the sidebar toggle has opened the menu", async () => {
    await phone();
    const screen = await render(AppShell, props());
    const toggle = screen.getByRole("button", { name: "Menu" });

    await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("lifts the bar off the page once the page has scrolled under it", async () => {
    await desktop();
    const tall = createRawSnippet(() => ({ render: () => '<div style="height: 3000px"></div>' }));
    const screen = await render(AppShell, props({ children: tall }));
    const bar = screen.getByRole("banner").element();

    expect(bar.getAttribute("data-scrolled")).toBe("false");
    expect(getComputedStyle(bar).boxShadow).toBe("none");

    window.scrollTo(0, 200);
    await expect.poll(() => bar.getAttribute("data-scrolled")).toBe("true");
    await expect.poll(() => getComputedStyle(bar).boxShadow).not.toBe("none");
    await expect.poll(() => getComputedStyle(bar).borderBottomColor).not.toBe("rgba(0, 0, 0, 0)");

    window.scrollTo(0, 0);
    await expect.poll(() => bar.getAttribute("data-scrolled")).toBe("false");
  });

  it("centres the account button and the logo in the space above the panel", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const centre = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    const panelTop = document.querySelector("#main-content")!.getBoundingClientRect().top;
    const button = screen.getByRole("button", { name: "Siti Rahma, account menu" }).element();
    const logo = screen.getByRole("link", { name: "VMB, go to the dashboard" }).element();

    expect(Math.abs(centre(button) - panelTop / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(centre(logo) - panelTop / 2)).toBeLessThanOrEqual(2);
    expect(button.getBoundingClientRect().top).toBeGreaterThanOrEqual(10);
  });

  it("shows the page's content below the top bar", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await expect.element(screen.getByRole("banner")).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: "Page body" })).toBeVisible();
  });

  it("falls back to the generated bot until a photo loads", async () => {
    await desktop();
    const screen = await render(AppShell, props({ user: { ...user, image: "/missing.png" } }));

    const bots = screen
      .getByRole("button", { name: "Siti Rahma, account menu" })
      .element()
      .querySelectorAll("[data-slot='avatar-fallback'] img");
    expect([...bots].map((bot) => bot.getAttribute("src"))).toEqual([
      "/(app)/avatar/u-1?theme=light",
      "/(app)/avatar/u-1?theme=dark"
    ]);
  });

  it("keeps the navigation behind a toggle on a phone", async () => {
    await phone();
    const screen = await render(AppShell, props());

    await expect.element(screen.getByRole("link", { name: "Divisions" })).not.toBeInTheDocument();

    await screen.getByRole("button", { name: "Menu" }).click();

    await expect.element(screen.getByRole("link", { name: "Divisions" })).toBeVisible();
  });

  it("collapses to icons from the sidebar's foot, and opens again from there or Ctrl+B", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const sidebar = () => document.querySelector("[data-slot='sidebar'][data-state]");

    expect(sidebar()?.getAttribute("data-state")).toBe("expanded");
    await screen.getByRole("button", { name: "Collapse sidebar" }).click();
    expect(sidebar()?.getAttribute("data-state")).toBe("collapsed");
    await expect
      .element(screen.getByRole("button", { name: "Expand sidebar" }))
      .toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Control>}b{/Control}");
    expect(sidebar()?.getAttribute("data-state")).toBe("expanded");
  });

  it("lets the panel slide shut with the labels clipped, not snapped away", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const container = () => document.querySelector<HTMLElement>("[data-slot='sidebar-container']")!;
    const link = () => screen.getByRole("link", { name: "Divisions" }).element();

    await screen.getByRole("button", { name: "Collapse sidebar" }).click();

    expect(container().getAttribute("data-narrow")).toBe("true");
    expect(container().getAttribute("data-closing")).toBe("true");
    // Still the closing panel's full width (34px at the rail), not the icon button's
    // 32px; the slide's position at this instant varies with the machine.
    expect(link().getBoundingClientRect().width).toBeGreaterThan(33);
    await expect.poll(() => container().getAttribute("data-closing")).toBe("false");
    await expect.poll(() => link().getBoundingClientRect().width).toBeLessThan(33);
  });

  it("keeps the logo moving only toward its resting place while the sidebar collapses", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const logo = () => document.querySelector("[data-slot='sidebar-header'] svg")!;
    const startLeft = logo().getBoundingClientRect().left;
    const lefts: number[] = [];

    await screen.getByRole("button", { name: "Collapse sidebar" }).click();
    const begin = performance.now();
    await new Promise<void>((done) => {
      const sample = () => {
        lefts.push(logo().getBoundingClientRect().left);
        if (performance.now() - begin < 400) requestAnimationFrame(sample);
        else done();
      };
      sample();
    });

    // Centred with flexbox it swung to the middle of the wide panel first.
    expect(Math.max(...lefts)).toBeLessThanOrEqual(startLeft + 0.5);
    expect(lefts.at(-1)!).toBeLessThan(startLeft - 8);
  });

  it("hides the menu button on desktop, where the sidebar collapses instead", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await expect.element(screen.getByRole("button", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("starts collapsed when the saved state says so", async () => {
    await desktop();
    await render(AppShell, props({ sidebarOpen: false }));

    expect(
      document.querySelector("[data-slot='sidebar'][data-state]")?.getAttribute("data-state")
    ).toBe("collapsed");
  });

  describe("peeking at the collapsed rail", () => {
    const container = () => document.querySelector<HTMLElement>("[data-slot='sidebar-container']")!;
    const gap = () => document.querySelector<HTMLElement>("[data-slot='sidebar-gap']")!;
    const content = () => document.querySelector<HTMLElement>("#main-content")!;
    const peeking = () => container().getAttribute("data-peek");
    const rem = (n: number) => n * parseFloat(getComputedStyle(document.documentElement).fontSize);

    it("opens over the page when the pointer rests on the rail, and the page stays put", async () => {
      await desktop();
      await render(AppShell, props({ sidebarOpen: false }));
      const railWidth = container().getBoundingClientRect().width;
      const pageLeft = content().getBoundingClientRect().left;

      await userEvent.hover(browser.elementLocator(container()));

      await expect.poll(peeking).toBe("true");
      await expect
        .poll(() => container().getBoundingClientRect().width)
        .toBeGreaterThanOrEqual(rem(16) - 1);
      expect(railWidth).toBeLessThan(rem(5));
      expect(gap().getBoundingClientRect().width).toBeLessThan(rem(5));
      expect(content().getBoundingClientRect().left).toBe(pageLeft);
      await expect.element(browser.getByRole("link", { name: "Divisions" })).toBeVisible();
      expect(
        browser.getByRole("link", { name: "Divisions" }).element().getBoundingClientRect().width
      ).toBeGreaterThan(rem(8));
    });

    it("closes again once the pointer leaves", async () => {
      await desktop();
      await render(AppShell, props({ sidebarOpen: false }));

      await userEvent.hover(browser.elementLocator(container()));
      await expect.poll(peeking).toBe("true");
      await userEvent.unhover(browser.elementLocator(container()));

      await expect.poll(peeking).toBe("false");
    });

    it("opens for keyboard focus and closes on Esc", async () => {
      await desktop();
      await render(AppShell, props({ sidebarOpen: false }));

      await userEvent.tab();
      await userEvent.tab();
      await userEvent.tab();
      await expect.poll(peeking).toBe("true");

      await userEvent.keyboard("{Escape}");
      await expect.poll(peeking).toBe("false");
    });

    it("ignores a touch pointer", async () => {
      await desktop();
      await render(AppShell, props({ sidebarOpen: false }));

      container().dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(peeking()).toBe("false");
    });

    it("does not peek when the sidebar is pinned open", async () => {
      await desktop();
      await render(AppShell, props());

      await userEvent.hover(browser.elementLocator(container()));
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(peeking()).toBe("false");
    });

    for (const scheme of ["light", "dark"] as const) {
      it(`has no axe violations while peeking in ${scheme} mode`, async () => {
        await desktop();
        document.documentElement.classList.toggle("dark", scheme === "dark");
        await render(AppShell, props({ sidebarOpen: false }));

        await userEvent.hover(browser.elementLocator(container()));
        await expect.poll(peeking).toBe("true");
        // Axe reads the colours it sees: wait out the panel's slide.
        await expect.poll(() => container().getAnimations({ subtree: true }).length).toBe(0);
        await expect
          .poll(() => container().getBoundingClientRect().width)
          .toBeGreaterThanOrEqual(rem(16) - 1);

        expect(await axeViolations(document.body)).toEqual([]);
      });
    }

    it("waits for the pointer to leave after the foot button collapses it", async () => {
      await desktop();
      const screen = await render(AppShell, props());

      await screen.getByRole("button", { name: "Collapse sidebar" }).click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(peeking()).toBe("false");

      await userEvent.unhover(browser.elementLocator(container()));
      await userEvent.hover(browser.elementLocator(container()));
      await expect.poll(peeking).toBe("true");
    });
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`has no axe violations in ${scheme} mode, with the user's menu open too`, async () => {
      await desktop();
      document.documentElement.classList.toggle("dark", scheme === "dark");
      const screen = await render(AppShell, props());

      await expect.element(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
      expect(await axeViolations(document.body)).toEqual([]);

      await screen.getByRole("button", { name: "Siti Rahma, account menu" }).click();
      await expect.element(screen.getByRole("menuitem", { name: "Log out" })).toBeVisible();
      // Axe reads the colours it sees: wait out the menu's fade-in.
      await expect
        .poll(
          () =>
            document.querySelector("[data-slot='dropdown-menu-content']")?.getAnimations().length
        )
        .toBe(0);
      expect(await axeViolations(document.body)).toEqual([]);
    });
  }
});
