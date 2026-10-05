<!--
  The frame of every signed-in screen (#167): a top bar across the full width
  (logo, sidebar toggle, the user's menu), the navigation below it, and the
  page in a rounded panel. Below 48rem the sidebar becomes a sheet behind the
  bar's toggle, and the bar keeps a line under it, since there is no panel edge
  to part it from the page; on desktop the line and a shadow appear once the page
  has scrolled under the bar. Search and notifications take the space between the toggle and
  the menu when those features exist. Sidebar state persists in the
  `sidebar_state` cookie, which the layout load reads back (`sidebarOpen`), so a
  reload keeps it without a flash.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import ProfileMenu from "$lib/components/ProfileMenu.svelte";
  import SidebarToggle from "$lib/components/SidebarToggle.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import VmbLogo from "$lib/components/VmbLogo.svelte";
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
  class="flex-col [--header-height:3.5rem] sm:[--header-height:4rem]"
>
  <header
    data-scrolled={scrollY > 0}
    class="bg-sidebar text-sidebar-foreground max-md:border-sidebar-border data-[scrolled=true]:border-sidebar-border sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-transparent px-3 transition-[border-color,box-shadow] duration-(--duration-panel) ease-(--easing-standard) data-[scrolled=true]:shadow-sm sm:px-4"
  >
    <!-- On a phone the logo moves into the menu sheet, freeing the bar for search and alerts. -->
    <a
      href={resolve("/")}
      class="focus-visible:ring-ring hidden rounded-md focus-visible:ring-2 focus-visible:outline-none md:block"
    >
      <VmbLogo class="h-8" title="VMB, go to the dashboard" />
    </a>
    <SidebarToggle />
    <div class="ml-auto">
      <ProfileMenu {user} {division} />
    </div>
  </header>

  <div class="flex flex-1">
    <Sidebar.Root
      variant="inset"
      collapsible="icon"
      class="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      <Sidebar.Header class="md:hidden">
        <a
          href={resolve("/")}
          class="focus-visible:ring-sidebar-ring flex h-10 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          <VmbLogo class="h-9" title="VMB, go to the dashboard" />
        </a>
      </Sidebar.Header>

      <Sidebar.Content>
        <nav aria-label="Main" class="flex flex-col gap-2">
          {#each groups as group (group.label)}
            <Sidebar.Group>
              <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  {#each group.items as item (item.href)}
                    {@const current = isCurrent(page.url.pathname, item.href)}
                    {@const Icon = ICONS[item.icon]}
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton
                        isActive={current}
                        tooltipContent={item.label}
                        class="pointer-coarse:h-11"
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
      </Sidebar.Content>
    </Sidebar.Root>

    <Sidebar.Inset
      id="main-content"
      tabindex={-1}
      class="max-w-none min-w-0 p-4 outline-none sm:p-6"
    >
      {@render children()}
    </Sidebar.Inset>
  </div>
</Sidebar.Provider>
