<!--
  The frame of every signed-in screen (#167): a sidebar down the left edge
  (`AppSidebar`: the logo, the navigation, the collapse button), a top bar over
  the page (the user's menu; the menu button on a phone), and the page in a
  rounded panel. Below 48rem the sidebar becomes a sheet behind the bar's menu
  button, and the bar keeps a line under it, since there is no panel edge to
  part it from the page; on desktop the line and a shadow appear once the page
  has scrolled under the bar. Search and notifications take the space in the bar
  when those features exist. Sidebar state persists in the `sidebar_state`
  cookie, which the layout load reads back (`sidebarOpen`), so a reload keeps it
  without a flash. The footer strip (#218) closes the column below the panel.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import AppSidebar from "$lib/components/AppSidebar.svelte";
  import ProfileMenu from "$lib/components/ProfileMenu.svelte";
  import SidebarToggle from "$lib/components/SidebarToggle.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { isCurrent, NAV_GROUPS, visibleGroups, type NavIcon } from "$lib/nav.js";
  import Building2 from "@lucide/svelte/icons/building-2";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import Users from "@lucide/svelte/icons/users";
  import type { Snippet } from "svelte";

  let {
    user,
    division,
    sidebarOpen,
    children
  }: {
    user: { id: string; name: string; email: string; image?: string | null };
    division: { name: string; iconName: string } | null;
    sidebarOpen: boolean;
    children: Snippet;
  } = $props();

  const ICONS: Record<NavIcon, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    divisions: Building2,
    roles: KeyRound,
    users: Users
  };

  const groups = visibleGroups(NAV_GROUPS);

  // The bar lifts off the page once the page has scrolled under it.
  let scrollY = $state(0);
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
                {@const Icon = ICONS[item.icon]}
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
    class="flex min-w-0 flex-1 flex-col md:peer-data-[state=collapsed]:[&>[data-slot=sidebar-inset]]:ml-2 md:peer-data-[state=collapsed]:[&>[data-slot=sidebar-inset]]:duration-(--duration-exit)"
  >
    <header
      data-scrolled={scrollY > 0}
      class="bg-sidebar text-sidebar-foreground max-md:border-sidebar-border data-[scrolled=true]:border-sidebar-border sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-transparent px-3 transition-[border-color,box-shadow] duration-(--duration-panel) ease-(--easing-standard) data-[scrolled=true]:shadow-sm sm:px-4"
    >
      <SidebarToggle />
      <div class="ml-auto">
        <ProfileMenu {user} {division} />
      </div>
    </header>

    <!-- app.css still gives every <main> auto side margins and a max width (the legacy
         page styles). On a phone those make the panel as wide as its widest content,
         which widens the page; `m-0 w-auto max-w-none` opt out, and the panel scrolls
         wide content itself. -->
    <Sidebar.Inset
      id="main-content"
      tabindex={-1}
      class="m-0 w-auto max-w-none min-w-0 overflow-x-auto p-4 transition-[margin-left] duration-(--duration-panel) ease-(--easing-standard) outline-none sm:p-6 md:m-2 md:mt-0 md:ml-0 md:rounded-xl md:shadow-sm"
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
