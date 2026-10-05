<!--
  The frame of every signed-in screen (#167): a top bar across the full width
  (logo, sidebar toggle, the user's menu), the navigation below it, and the
  page in a rounded panel. Below 48rem the sidebar becomes a sheet behind the
  bar's toggle, and the bar gets a line under it, since there is no panel edge
  to part it from the page. Search and notifications take the space between the toggle and
  the menu when those features exist. Sidebar state persists in the
  `sidebar_state` cookie, which the layout load reads back (`sidebarOpen`), so a
  reload keeps it without a flash.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import ProfileMenu from "$lib/components/ProfileMenu.svelte";
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
</script>

<a
  href="#main-content"
  class="bg-background text-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-2 focus-visible:outline-none"
>
  Skip to content
</a>

<Sidebar.Provider
  open={sidebarOpen}
  class="flex-col [--header-height:3.5rem] sm:[--header-height:4rem]"
>
  <header
    class="bg-sidebar text-sidebar-foreground max-md:border-sidebar-border sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 px-3 max-md:border-b sm:px-4"
  >
    <a
      href={resolve("/")}
      class="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <VmbLogo class="h-8" title="VMB, go to the dashboard" />
    </a>
    <Sidebar.Trigger class="pointer-coarse:size-11" />
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
