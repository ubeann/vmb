import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page as browser, userEvent } from "vitest/browser";

// Isolated renders don't load the global stylesheet; the sidebar's responsive
// switch and axe's colour reads are styles.
import "../../app.css";

import { axeViolations } from "$lib/a11y-support.js";

const mockPage: { url: URL; data: Record<string, unknown> } = {
  url: new URL("http://localhost/"),
  data: {}
};

vi.mock("$app/paths", () => ({
  resolve: (path: string, params: Record<string, string> = {}) =>
    Object.entries(params).reduce((out, [key, value]) => out.replace(`[${key}]`, value), path)
}));
vi.mock("$app/state", () => ({ page: mockPage }));

type Navigation = { type: string; from: { url: URL } | null; to: { url: URL } | null };
let navigated: (navigation: Navigation) => void = () => {};
vi.mock("$app/navigation", () => ({
  afterNavigate: (callback: typeof navigated) => (navigated = callback)
}));

const { render } = await import("vitest-browser-svelte");
const { modeStorageKey, resetMode } = await import("mode-watcher");
const { shortcuts } = await import("$lib/components/shortcuts.svelte.js");
const { default: AppShell } = await import("./AppShell.svelte");

const body = createRawSnippet(() => ({ render: () => "<h1>Page body</h1>" }));

const user = { id: "u-1", name: "Siti Rahma", email: "siti@vmblogistics.id" };
const division = { name: "Warehouse", iconName: "heroicon-o-building-storefront" };

const props = (overrides: Record<string, unknown> = {}) => ({
  user,
  division,
  sidebarOpen: true,
  sidebarSaved: true,
  children: body,
  ...overrides
});

const desktop = () => browser.viewport(1280, 800);
const phone = () => browser.viewport(390, 844);

afterEach(() => {
  shortcuts.open = false;
  shortcuts.singleKey = true;
  localStorage.clear();
  resetMode();
  document.cookie = "sidebar_state=; path=/; max-age=0";
  mockPage.url = new URL("http://localhost/");
  mockPage.data = {};
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

  // ADR-0036, "Signed-in panel": a white sheet on the warm frame in light mode; in dark mode
  // the card is the sidebar's colour, so the panel keeps the background to stay apart from it.
  it("paints the panel as a card in light mode and the background in dark", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const panel = screen.container.querySelector("#main-content")!;
    const painted = (token: string) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = `var(${token})`;
      document.body.append(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    };

    expect(getComputedStyle(panel).backgroundColor).toBe(painted("--card"));

    document.documentElement.classList.add("dark");
    expect(getComputedStyle(panel).backgroundColor).toBe(painted("--background"));
    expect(painted("--card")).not.toBe(painted("--background"));
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
    await screen.getByRole("button", { name: "Siti Rahma, Warehouse, account menu" }).click();

    const group = screen.getByRole("menuitemradio", { name: "Light" }).element().parentElement!;
    await expect.poll(() => group.getBoundingClientRect().height).toBe(40);
  });

  it("opens the user's menu with their identity and division", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, Warehouse, account menu" }).click();

    await expect.element(screen.getByText("siti@vmblogistics.id")).toBeVisible();
    await expect.element(screen.getByText("Division", { exact: true })).toBeVisible();
    await expect.element(screen.getByText("Warehouse").last()).toBeVisible();
  });

  it("says so when the user has no division", async () => {
    await desktop();
    const screen = await render(AppShell, props({ division: null }));

    await screen.getByRole("button", { name: "Siti Rahma, No division, account menu" }).click();

    await expect.element(screen.getByText("No division").last()).toBeVisible();
  });

  it("signs out with a form post from the user's menu", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, Warehouse, account menu" }).click();

    const logOut = screen.getByRole("menuitem", { name: "Log out" });
    await expect.element(logOut).toBeVisible();
    const form = logOut.element().closest("form");
    expect(form?.method).toBe("post");
    expect(form?.getAttribute("action")).toBe("/logout");
  });

  it("chooses the theme from the user's menu without closing it", async () => {
    await desktop();
    const screen = await render(AppShell, props());

    await screen.getByRole("button", { name: "Siti Rahma, Warehouse, account menu" }).click();
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

    await screen.getByRole("button", { name: "Siti Rahma, Warehouse, account menu" }).click();

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
    const circle = small
      .getByRole("button", { name: "Siti Rahma, Warehouse, account menu" })
      .element();
    const { width, height } = circle.getBoundingClientRect();

    expect(width).toBe(height);
    expect(parseFloat(getComputedStyle(circle).borderTopLeftRadius)).toBeGreaterThanOrEqual(
      height / 2
    );
    small.unmount();

    await desktop();
    const large = await render(AppShell, props());
    const pill = large
      .getByRole("button", { name: "Siti Rahma, Warehouse, account menu" })
      .element();

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

    expect(getComputedStyle(large.getByRole("banner").element()).borderBottomWidth).toBe("0px");
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

  it("lifts the bar off the page on a phone once the page has scrolled under it", async () => {
    await phone();
    const tall = createRawSnippet(() => ({ render: () => '<div style="height: 3000px"></div>' }));
    const screen = await render(AppShell, props({ children: tall }));
    const bar = screen.getByRole("banner").element();

    expect(bar.getAttribute("data-scrolled")).toBe("false");
    expect(getComputedStyle(bar).boxShadow).toBe("none");

    window.scrollTo(0, 200);
    await expect.poll(() => bar.getAttribute("data-scrolled")).toBe("true");
    await expect.poll(() => getComputedStyle(bar).boxShadow).not.toBe("none");

    window.scrollTo(0, 0);
    await expect.poll(() => bar.getAttribute("data-scrolled")).toBe("false");
  });

  it("scrolls the panel, not the page, on desktop, so nothing slides under the bar", async () => {
    await desktop();
    const tall = createRawSnippet(() => ({ render: () => '<div style="height: 3000px"></div>' }));
    const screen = await render(AppShell, props({ children: tall }));
    const panel = document.querySelector("#main-content")!;

    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
    expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);

    panel.scrollTop = 200;
    await expect.poll(() => panel.scrollTop).toBe(200);
    expect(getComputedStyle(screen.getByRole("banner").element()).boxShadow).toBe("none");
  });

  it("starts the panel at the top for another screen or page, and keeps it otherwise", async () => {
    await desktop();
    const tall = createRawSnippet(() => ({ render: () => '<div style="height: 3000px"></div>' }));
    await render(AppShell, props({ children: tall }));
    const panel = document.querySelector("#main-content")!;
    const go = (type: string, from: string, to: string) =>
      navigated({
        type,
        from: { url: new URL(from, "http://localhost") },
        to: { url: new URL(to, "http://localhost") }
      });

    for (const [type, from, to, top] of [
      ["link", "/master/divisions", "/master/divisions?sort=code", 300],
      ["goto", "/master/divisions", "/master/divisions?perPage=50", 300],
      ["popstate", "/master/roles", "/master/divisions", 300],
      ["link", "/master/divisions", "/master/divisions?page=2", 0],
      ["link", "/master/divisions", "/master/roles", 0]
    ] as const) {
      panel.scrollTop = 300;
      go(type, from, to);
      expect(panel.scrollTop, `${type} ${from} -> ${to}`).toBe(top);
    }
  });

  it("centres the account button and the logo in the space above the panel", async () => {
    await desktop();
    const screen = await render(AppShell, props());
    const centre = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    const panelTop = document.querySelector("#main-content")!.getBoundingClientRect().top;
    const button = screen
      .getByRole("button", { name: "Siti Rahma, Warehouse, account menu" })
      .element();
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

  describe("the footer strip", () => {
    const supportLink = (screen: Awaited<ReturnType<typeof render>>) =>
      screen.getByRole("link", { name: "support@vmblogistics.id", exact: true });
    const supportIcon = (screen: Awaited<ReturnType<typeof render>>) =>
      screen.getByRole("link", { name: "Email the support team, support@vmblogistics.id" });

    it("sits below the panel as the page's contentinfo landmark, not inside it", async () => {
      await desktop();
      const screen = await render(AppShell, props());

      const footer = screen.getByRole("contentinfo");
      await expect.element(footer).toBeVisible();
      await expect.element(footer.getByText(/PT\. Vifiera Minova Bersaudara/)).toBeVisible();
      const panel = document.querySelector("#main-content")!;
      expect(panel.contains(footer.element())).toBe(false);
      expect(footer.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
        panel.getBoundingClientRect().bottom
      );
    });

    it("gives its text 8px on the left and 12px on the right from tablet up", async () => {
      for (const [width, height] of [
        [1920, 1080],
        [768, 1024]
      ] as const) {
        await browser.viewport(width, height);
        for (const sidebarOpen of [true, false]) {
          const screen = await render(AppShell, props({ sidebarOpen }));
          const strip = screen.getByRole("contentinfo").element().getBoundingClientRect();
          const text = screen
            .getByText(/PT\. Vifiera Minova Bersaudara/)
            .element()
            .getBoundingClientRect();
          const last = screen.getByRole("link", { name: /ubeann/ }).element();
          const label = `${width}px, open: ${sidebarOpen}`;

          expect(text.left - strip.left, label).toBeCloseTo(8, 0);
          expect(strip.right - last.getBoundingClientRect().right, label).toBeCloseTo(12, 0);
          screen.unmount();
        }
      }
    });

    it("keeps the panel's 16px on both sides on a phone", async () => {
      await phone();
      const screen = await render(AppShell, props());
      const strip = screen.getByRole("contentinfo").element().getBoundingClientRect();
      const text = screen
        .getByText(/PT\. Vifiera Minova Bersaudara/)
        .element()
        .getBoundingClientRect();
      const last = screen.getByRole("link", { name: /ubeann/ }).element();

      expect(text.left - strip.left).toBeCloseTo(16, 0);
      expect(strip.right - last.getBoundingClientRect().right).toBeGreaterThanOrEqual(16);
    });

    it("spells out the support address and credit while the column has room", async () => {
      await browser.viewport(1440, 900);
      const screen = await render(AppShell, props());

      await expect.element(supportLink(screen)).toBeVisible();
      await expect.element(screen.getByRole("link", { name: "ubeann", exact: true })).toBeVisible();
      await expect.element(supportIcon(screen)).not.toBeInTheDocument();
    });

    it("drops to icon buttons when an open sidebar narrows the column, though the viewport is wide", async () => {
      // 1200px is past the old `lg:` breakpoint, but the column beside a 16rem sidebar is 944px.
      await browser.viewport(1200, 800);
      const open = await render(AppShell, props());

      await expect.element(supportIcon(open)).toBeVisible();
      await expect.element(supportLink(open)).not.toBeInTheDocument();
      open.unmount();

      const collapsed = await render(AppShell, props({ sidebarOpen: false }));

      await expect.element(supportLink(collapsed)).toBeVisible();
      await expect.element(supportIcon(collapsed)).not.toBeInTheDocument();
    });

    it("keeps the icon buttons 44px square on a phone", async () => {
      await phone();
      const screen = await render(AppShell, props());

      const { width, height } = supportIcon(screen).element().getBoundingClientRect();
      expect([width, height]).toEqual([44, 44]);
    });
  });

  it("falls back to the generated bot until a photo loads", async () => {
    await desktop();
    const screen = await render(AppShell, props({ user: { ...user, image: "/missing.png" } }));

    const bots = screen
      .getByRole("button", { name: "Siti Rahma, Warehouse, account menu" })
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

  // ADR-0050, "Room on tablets": 640–1023px gives the page more room, with a 16px panel and
  // the sidebar on its icon rail, unless the user's own choice (the cookie) says otherwise.
  describe("room on tablets", () => {
    const sidebarState = () =>
      document.querySelector("[data-slot='sidebar'][data-state]")?.getAttribute("data-state");
    const panelPadding = () => {
      const style = getComputedStyle(document.querySelector("#main-content")!);
      return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
    };

    it("pads the panel by 16px from 640 to 1023px and 24px from 1024px", async () => {
      for (const [width, padding] of [
        [390, "16px"],
        [640, "16px"],
        [768, "16px"],
        [1023, "16px"],
        [1024, "24px"],
        [1440, "24px"]
      ] as const) {
        await browser.viewport(width, 900);
        const screen = await render(AppShell, props({ sidebarSaved: false }));
        expect(panelPadding(), `${width}px`).toEqual([padding, padding, padding, padding]);
        screen.unmount();
      }
    });

    it("starts on the icon rail on a tablet when nothing was saved", async () => {
      for (const width of [768, 1023]) {
        await browser.viewport(width, 900);
        const screen = await render(AppShell, props({ sidebarOpen: true, sidebarSaved: false }));
        await expect.poll(sidebarState, { message: `${width}px` }).toBe("collapsed");
        screen.unmount();
      }
    });

    it("follows the screen across the tablet range while nothing is chosen", async () => {
      await browser.viewport(768, 900);
      await render(AppShell, props({ sidebarOpen: true, sidebarSaved: false }));
      await expect.poll(sidebarState).toBe("collapsed");

      await browser.viewport(1100, 900);
      await expect.poll(sidebarState).toBe("expanded");
      await browser.viewport(800, 900);
      await expect.poll(sidebarState).toBe("collapsed");
    });

    it("leaves the sidebar open from 1024px when nothing was saved", async () => {
      await browser.viewport(1024, 900);
      await render(AppShell, props({ sidebarOpen: true, sidebarSaved: false }));
      // give the tablet default the chance it must not take
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sidebarState()).toBe("expanded");
    });

    it("lets a saved choice win: open stays open, collapsed stays collapsed", async () => {
      await browser.viewport(768, 900);
      const open = await render(AppShell, props({ sidebarOpen: true, sidebarSaved: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sidebarState()).toBe("expanded");
      open.unmount();

      await render(AppShell, props({ sidebarOpen: false, sidebarSaved: true }));
      expect(sidebarState()).toBe("collapsed");
    });

    it("saves nothing for the default, and the first toggle saves a choice that then stands", async () => {
      await browser.viewport(768, 900);
      const screen = await render(AppShell, props({ sidebarOpen: true, sidebarSaved: false }));
      await expect.poll(sidebarState).toBe("collapsed");
      expect(document.cookie).not.toContain("sidebar_state");

      await screen.getByRole("button", { name: "Expand sidebar" }).click();
      await expect.poll(sidebarState).toBe("expanded");
      expect(document.cookie).toContain("sidebar_state=true");

      // crossing back and forth over the tablet range doesn't undo what the user chose
      await browser.viewport(1100, 900);
      await browser.viewport(768, 900);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sidebarState()).toBe("expanded");
    });
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

  describe("the top bar", () => {
    it("orders its slots: menu button, breadcrumb trail, then the user's menu at the right edge", async () => {
      await desktop();
      mockPage.url = new URL("http://localhost/master/divisions/d-1");
      mockPage.data = {
        crumb: { label: "Finance", tile: { iconName: "heroicon-o-banknotes", colorHex: "#0f766e" } }
      };
      const screen = await render(AppShell, props());

      const header = document.querySelector("header")!;
      const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
      await expect.element(trail).toBeVisible();
      expect(trail.element().querySelector("[aria-current='page']")?.textContent?.trim()).toBe(
        "Finance"
      );

      const x = (el: Element) => el.getBoundingClientRect();
      const toggle = header.querySelector("button")!;
      const profile = header.querySelector("[aria-label$='account menu']")!;
      expect(x(toggle).right).toBeLessThanOrEqual(x(trail.element()).left);
      expect(x(trail.element()).right).toBeLessThanOrEqual(x(profile).left);
      expect(x(profile).right).toBeGreaterThan(header.getBoundingClientRect().right - 32);
    });

    it("shows a single crumb on the dashboard", async () => {
      await desktop();
      const screen = await render(AppShell, props());

      const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
      expect(trail.element().querySelectorAll("li")).toHaveLength(1);
      await expect.element(trail.getByText("Dashboard")).toBeVisible();
    });

    it("keeps the bar inside a phone, with a long record name truncated", async () => {
      await phone();
      mockPage.url = new URL("http://localhost/master/divisions/d-1/edit");
      mockPage.data = { crumb: { label: "A division with a remarkably long name ".repeat(4) } };
      const screen = await render(AppShell, props());

      const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
      await expect.element(trail.getByRole("link", { name: "Divisions" })).toBeVisible();
      await expect.element(trail.getByText("Edit")).not.toBeVisible();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      const header = document.querySelector("header")!;
      expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
    });

    it("truncates a long record name on a desktop without pushing the user's menu away", async () => {
      await desktop();
      mockPage.url = new URL("http://localhost/master/divisions/d-1");
      mockPage.data = { crumb: { label: "A division with a remarkably long name ".repeat(8) } };
      const screen = await render(AppShell, props());

      const profile = document.querySelector("header [aria-label$='account menu']")!;
      await expect.element(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
      expect(profile.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
      const header = document.querySelector("header")!;
      expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
    });
  });

  for (const scheme of ["light", "dark"] as const) {
    it(`has no axe violations in ${scheme} mode, with the user's menu open too`, async () => {
      await desktop();
      document.documentElement.classList.toggle("dark", scheme === "dark");
      const screen = await render(AppShell, props());

      await expect.element(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
      expect(await axeViolations(document.body)).toEqual([]);

      await screen.getByRole("button", { name: "Siti Rahma, Warehouse, account menu" }).click();
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
  describe("shortcuts (ADR-0052)", () => {
    const sheet = () => browser.getByRole("dialog", { name: "Keyboard shortcuts" });

    it("puts a Shortcuts row above Collapse in the footer, and it opens the sheet", async () => {
      await desktop();
      const screen = await render(AppShell, props());
      const row = screen.getByRole("button", { name: /Shortcuts/ });
      const collapse = screen.getByRole("button", { name: "Collapse sidebar" });

      expect(row.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(
        collapse.element().getBoundingClientRect().top
      );
      await row.click();

      await expect.element(sheet()).toBeVisible();
      await expect.element(sheet().getByText("Collapse or expand the sidebar")).toBeVisible();
    });

    it("still opens from the Shortcuts row with single-key shortcuts off, which keep ? and the rest quiet but not Ctrl B", async () => {
      await desktop();
      shortcuts.setSingleKey(false);
      const screen = await render(AppShell, props());
      const sidebar = () => document.querySelector("[data-slot='sidebar'][data-state]");
      const row = screen.getByRole("button", { name: /Shortcuts/ });

      await userEvent.keyboard("?");
      await expect.element(sheet()).not.toBeInTheDocument();
      await expect.element(row).not.toHaveAttribute("aria-keyshortcuts");

      await userEvent.keyboard("{Control>}b{/Control}");
      expect(sidebar()?.getAttribute("data-state")).toBe("collapsed");
      await userEvent.keyboard("{Control>}b{/Control}");
      expect(sidebar()?.getAttribute("data-state")).toBe("expanded");

      await row.click();
      await expect.element(sheet()).toBeVisible();
      await expect
        .element(sheet().getByRole("switch", { name: "Single-key shortcuts" }))
        .not.toBeChecked();
    });

    it("opens the sheet on ? from the page, and not from the search field", async () => {
      await desktop();
      const screen = await render(
        AppShell,
        props({
          children: createRawSnippet(() => ({
            render: () => '<input aria-label="Search" />'
          }))
        })
      );

      await screen.getByRole("textbox", { name: "Search" }).click();
      await userEvent.keyboard("?");
      await expect.element(sheet()).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("main"));
      await userEvent.keyboard("?");
      await expect.element(sheet()).toBeVisible();
    });

    it("keeps the row on the collapsed rail as an icon with a tooltip", async () => {
      await desktop();
      const screen = await render(AppShell, props({ sidebarOpen: false }));
      const row = screen.getByRole("button", { name: /Shortcuts/ });

      const { width } = row.element().getBoundingClientRect();
      expect(width).toBe(32);
      await userEvent.hover(row);
      await expect
        .poll(() => document.querySelector("[data-slot='tooltip-content']")?.textContent)
        .toContain("Keyboard shortcuts");
    });

    it("hides the row on a touch screen", async () => {
      await desktop();
      const screen = await render(AppShell, props());
      const row = screen.getByRole("button", { name: /Shortcuts/ }).element();
      expect(getComputedStyle(row.closest("li")!).display).not.toBe("none");

      await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      try {
        await expect.poll(() => getComputedStyle(row.closest("li")!).display).toBe("none");
      } finally {
        await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });
  });
});
