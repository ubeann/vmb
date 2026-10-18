<!--
  The frame of every signed-in screen (#167): a sidebar down the left edge
  (`AppSidebar`: the logo, the navigation, the collapse button), a top bar over
  the page (the user's menu; the menu button on a phone), and the page in a
  rounded panel. The window scrolls at every width (ADR-0050, 2026-10-13, "The
  footer strip"): the bar stays at the top and the panel slides under it, and the
  column is at least the window's height, so the footer strip sits at the window's
  foot on a short page and after the panel on a long one. While the shell is on the
  page the root takes the frame's colour, so a bounce past either end on macOS or
  iPadOS shows more frame, and anything scrolled into view stops below the bar. Below
  48rem the sidebar becomes a sheet behind the bar's menu button, and the bar keeps a
  line under it, since there is no panel edge to part it from the page, and a shadow
  once the page has scrolled under it. The bar's slots, left to right (ADR-0050): the menu button, the breadcrumb trail, then at the right edge
  the user's menu, where search (#282) and notifications (#283) will join it, with no
  placeholder until they exist. Below `md` the trail is hidden: the bar holds the menu
  button and the user's menu only, and the way back is the browser's gesture or a
  record page's own "Back to …" link. Sidebar state persists in the `sidebar_state`
  cookie, which the layout load reads back (`sidebarOpen`), so a reload keeps it
  without a flash. The footer strip (#218) closes the column below the panel. The one
  shortcut sheet (ADR-0052) lives here, so `?` opens it on every signed-in page.

  Room on tablets (ADR-0050): from 640 to 1023px the panel pads 16px, not 24, and
  a sidebar nobody has toggled (`sidebarSaved` false: no cookie) starts as its icon
  rail. The rail is the default, not an override: the first toggle saves the
  user's own choice, and a saved one is never second-guessed. The default is
  applied once the page is up, so the server-rendered page and its hydration agree; until
  then the server's open sidebar is flagged (`AppSidebar`'s `railDefault`) and app.css paints
  it as the rail from the first frame, so nothing slides when the default is taken.
-->
<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import AppBreadcrumbs from "$lib/components/AppBreadcrumbs.svelte";
  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import ProfileMenu from "$lib/components/ProfileMenu.svelte";
  import ShortcutsSheet from "$lib/components/ShortcutsSheet.svelte";
  import SidebarToggle from "$lib/components/SidebarToggle.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { trailFor } from "$lib/breadcrumbs.js";
  import { canOpen, isCurrent, NAV_GROUPS, visibleGroups } from "$lib/nav.js";
  import { NAV_ICONS } from "$lib/nav-icons.js";
  import { onMount, type Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";

  let {
    user,
    division,
    permissions,
    sidebarOpen,
    sidebarSaved,
    children
  }: {
    user: { id: string; name: string; email: string; image?: string | null };
    division: { name: string; iconName: string } | null;
    /** What the caller's roles grant: the sidebar lists only the screens they may open. */
    permissions: readonly string[];
    sidebarOpen: boolean;
    /** Whether `sidebarOpen` is the user's own saved choice, rather than the default. */
    sidebarSaved: boolean;
    children: Snippet;
  } = $props();

  const groups = $derived(visibleGroups(NAV_GROUPS, canOpen(permissions)));

  // The user's toggle, once there is one: it wins over the tablet default from then on.
  let chosen = $state<boolean | null>(null);
  const tablet = new MediaQuery("(min-width: 640px) and (max-width: 1023.98px)");
  let mounted = $state(false);
  onMount(() => (mounted = true));
  const open = $derived(chosen ?? (sidebarSaved ? sidebarOpen : !(mounted && tablet.current)));

  // the trail names where a page sits, so it reads the whole menu: a record opened by its link
  // keeps its crumbs when its list is not the caller's to open
  const trail = $derived(trailFor(page.url.pathname, page.data.crumb));

  // On a phone the bar lifts off the page once the page has scrolled under it.
  let scrollY = $state(0);

  // From 48rem another screen or another page of a list starts at the top, even from a
  // `noscroll` refinement that sends the list back to page 1; one that keeps the page
  // (sort, filter, tab, search, page size) keeps the place, as its `noscroll` asks.
  // On a phone SvelteKit alone decides, as it always has. Back and forward are
  // SvelteKit's own at every width: it keeps the window's scroll for each history entry.
  const wide = new MediaQuery("(min-width: 48rem)");
  afterNavigate(({ type, from, to }) => {
    if (!wide.current || type === "enter" || type === "popstate" || !from || !to) return;
    const samePage =
      from.url.pathname === to.url.pathname &&
      from.url.searchParams.get("page") === to.url.searchParams.get("page");
    if (!samePage && !to.url.hash) window.scrollTo(0, 0);
  });
</script>

<a
  href="#main-content"
  class="bg-background text-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-2 focus-visible:outline-none"
>
  Skip to content
</a>

<svelte:window bind:scrollY />

<Sidebar.Provider {open} onOpenChange={(next) => (chosen = next)}>
  <AppSidebar railDefault={!sidebarSaved && chosen === null}>
    <nav aria-label="Main" class="flex flex-col gap-2">
      {#each groups as group (group.label)}
        <Sidebar.Group>
          <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu class="gap-1">
              {#each group.items as item (item.href)}
                {@const current = isCurrent(page.url.pathname, item.href)}
                {@const Icon = NAV_ICONS[item.icon]}
                <Sidebar.MenuItem class="rail:py-1 transition-[padding]">
                  <Sidebar.MenuButton
                    isActive={current}
                    class="data-[active=true]:bg-sidebar-primary/15 dark:data-[active=true]:bg-sidebar-accent h-10 pointer-coarse:h-11"
                  >
                    {#snippet child({ props })}
                      <a
                        {...props}
                        href={resolve(item.href)}
                        aria-current={current ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </a>
                    {/snippet}
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              {/each}
            </Sidebar.Menu>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      {/each}
    </nav>
  </AppSidebar>

  <div
    class="md:peer-folded:[&>[data-slot=sidebar-inset]]:ml-2 md:peer-folded:[&>[data-slot=sidebar-inset]]:duration-(--duration-exit) flex min-h-svh min-w-0 flex-1 flex-col"
  >
    <header
      data-scrolled={scrollY > 0}
      class="bg-sidebar text-sidebar-foreground max-md:border-sidebar-border sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 px-3 transition-shadow duration-(--duration-panel) ease-(--easing-standard) max-md:border-b max-md:data-[scrolled=true]:shadow-sm sm:px-4"
    >
      <SidebarToggle />
      <div class="min-w-0 max-md:hidden"><AppBreadcrumbs {trail} /></div>
      <div class="ml-auto shrink-0">
        <ProfileMenu {user} {division} />
      </div>
    </header>

    <!-- `w-auto` replaces the inset's `w-full`, which with the panel's margins would overflow.
         The panel scrolls wide content itself; tall content scrolls the window.
         `*:shrink-0` keeps its column from squeezing a child (one with `overflow-hidden`
         has no content floor).
         A page caps and centres its own content with `Page` (ADR-0050), so the panel
         stays full width. In light mode the panel is a white sheet on the warm frame,
         so the page is two layers and its tables sit on the same white (ADR-0036,
         "Signed-in panel"); dark mode keeps the background, since its card is the
         sidebar's colour and would merge the panel into the frame. -->
    <Sidebar.Inset
      id="main-content"
      tabindex={-1}
      class="bg-card dark:bg-background w-auto min-w-0 overflow-x-auto p-4 transition-[margin-left] duration-(--duration-panel) ease-(--easing-standard) outline-none md:m-2 md:mt-0 md:ml-0 md:rounded-xl md:shadow-sm md:*:shrink-0 lg:p-6"
    >
      {@render children()}
    </Sidebar.Inset>

    <!-- Below the panel, not inside it, so it stays the page's contentinfo landmark.
         It sits on the sidebar's colour. From tablet up it takes 8px on the left and
         12px on the right; the phone keeps the panel's 16px. `sm:px-3` and `lg:px-3`
         beat SiteFooter's own `sm:px-10 lg:px-16`. -->
    <SiteFooter class="max-w-none px-4 pt-2 pb-3 sm:px-3 sm:pl-2 lg:px-3 lg:pl-2" />
  </div>
</Sidebar.Provider>

<ShortcutsSheet />

<style>
  /* A bounce past either end on macOS or iPadOS shows the canvas, which takes the body's
     background unless the root has its own: the frame's makes it read as more frame. The
     bar's height lives here, not on the wrapper, so the window's scroll padding can read it
     and a row, the skip link's landing or a hash target stops below the sticky bar. */
  :global(html:has([data-slot="sidebar-wrapper"])) {
    --header-height: 3.5rem;
    background-color: var(--sidebar);
    scroll-padding-top: var(--header-height);
  }
  @media (min-width: 40rem) {
    :global(html:has([data-slot="sidebar-wrapper"])) {
      --header-height: 4rem;
    }
  }
  @media (min-width: 48rem) {
    :global(html:has([data-slot="sidebar-wrapper"])) {
      --header-height: 4.5rem;
    }
  }
</style>
