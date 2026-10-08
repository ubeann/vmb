<!--
  The frame of every signed-in screen (#167): a sidebar down the left edge
  (`AppSidebar`: the logo, the navigation, the collapse button), a top bar over
  the page (the user's menu; the menu button on a phone), and the page in a
  rounded panel. From 48rem up the shell fills the window and the panel scrolls
  inside itself, so the page never slides under the bar and the sheet keeps all
  four corners; nothing there needs a scrolled state. Below 48rem the sidebar
  becomes a sheet behind the bar's menu button and the window scrolls as usual:
  the bar keeps a line under it, since there is no panel edge to part it from
  the page, and a shadow once the page has scrolled under it. The bar's slots, left
  to right (ADR-0050): the menu button, the breadcrumb trail, then at the right edge
  the user's menu, where search (#282) and notifications (#283) will join it, with no
  placeholder until they exist. Sidebar state persists in the `sidebar_state`
  cookie, which the layout load reads back (`sidebarOpen`), so a reload keeps it
  without a flash. The footer strip (#218) closes the column below the panel.
-->
<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import AppBreadcrumbs from "$lib/components/AppBreadcrumbs.svelte";
  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import ProfileMenu from "$lib/components/ProfileMenu.svelte";
  import SidebarToggle from "$lib/components/SidebarToggle.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { trailFor } from "$lib/breadcrumbs.js";
  import { isCurrent, NAV_GROUPS, visibleGroups } from "$lib/nav.js";
  import { NAV_ICONS } from "$lib/nav-icons.js";
  import type { Snippet } from "svelte";

  let {
    user,
    division,
    sidebarOpen,
    panel = $bindable(null),
    children
  }: {
    user: { id: string; name: string; email: string; image?: string | null };
    division: { name: string; iconName: string } | null;
    sidebarOpen: boolean;
    /** The scrolling panel, for the layout's snapshot to keep its place across history. */
    panel?: HTMLElement | null;
    children: Snippet;
  } = $props();

  const groups = visibleGroups(NAV_GROUPS);

  const trail = $derived(trailFor(page.url.pathname, page.data.crumb, groups));

  // On a phone the bar lifts off the page once the page has scrolled under it.
  let scrollY = $state(0);

  // SvelteKit resets and restores the window's scroll, which never moves on desktop, so
  // the panel needs the same: another screen or another page of a list starts at the
  // top. Refining a list in place (sort, filter, tab, search, page size) keeps the
  // place, as their `noscroll` asks, and those already send the list back to page 1.
  // Back and forward are the layout's snapshot, so `popstate` is left alone.
  afterNavigate(({ type, from, to }) => {
    if (!panel || type === "enter" || type === "popstate" || !from || !to) return;
    const samePage =
      from.url.pathname === to.url.pathname &&
      from.url.searchParams.get("page") === to.url.searchParams.get("page");
    if (!samePage && !to.url.hash) panel.scrollTop = 0;
  });
</script>

<a
  href="#main-content"
  class="bg-background text-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-2 focus-visible:outline-none"
>
  Skip to content
</a>

<svelte:window bind:scrollY />

<Sidebar.Provider
  open={sidebarOpen}
  class="[--header-height:3.5rem] sm:[--header-height:4rem] md:[--header-height:4.5rem]"
>
  <AppSidebar>
    <nav aria-label="Main" class="flex flex-col gap-2">
      {#each groups as group (group.label)}
        <Sidebar.Group>
          <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
          <Sidebar.GroupContent>
            <Sidebar.Menu class="gap-1">
              {#each group.items as item (item.href)}
                {@const current = isCurrent(page.url.pathname, item.href)}
                {@const Icon = NAV_ICONS[item.icon]}
                <Sidebar.MenuItem class="transition-[padding] group-data-[collapsible=icon]:py-1">
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
    class="flex min-w-0 flex-1 flex-col md:h-svh md:peer-data-[state=collapsed]:[&>[data-slot=sidebar-inset]]:ml-2 md:peer-data-[state=collapsed]:[&>[data-slot=sidebar-inset]]:duration-(--duration-exit)"
  >
    <header
      data-scrolled={scrollY > 0}
      class="bg-sidebar text-sidebar-foreground max-md:border-sidebar-border sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 px-3 transition-shadow duration-(--duration-panel) ease-(--easing-standard) max-md:border-b max-md:data-[scrolled=true]:shadow-sm sm:px-4"
    >
      <SidebarToggle />
      <AppBreadcrumbs {trail} />
      <div class="ml-auto shrink-0">
        <ProfileMenu {user} {division} />
      </div>
    </header>

    <!-- app.css still gives every <main> auto side margins and a max width (the legacy
         page styles). On a phone those make the panel as wide as its widest content,
         which widens the page; `m-0 w-auto max-w-none` opt out, and the panel scrolls
         wide content itself; from 48rem up it scrolls tall content too, between the bar
         and the footer, and `*:shrink-0` keeps its column from squeezing a child (one
         with `overflow-hidden` has no content floor) instead of scrolling. In light mode the panel is a white sheet on the warm frame,
         so the page is two layers and its tables sit on the same white (ADR-0036,
         "Signed-in panel"); dark mode keeps the background, since its card is the
         sidebar's colour and would merge the panel into the frame. -->
    <Sidebar.Inset
      bind:ref={panel}
      id="main-content"
      tabindex={-1}
      class="bg-card dark:bg-background m-0 w-auto max-w-none min-w-0 overflow-x-auto p-4 transition-[margin-left] duration-(--duration-panel) ease-(--easing-standard) outline-none sm:p-6 md:m-2 md:mt-0 md:ml-0 md:min-h-0 md:overflow-y-auto md:rounded-xl md:shadow-sm md:*:shrink-0"
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
