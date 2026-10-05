<!--
  The frame of every signed-in screen (#167): a collapsible sidebar with the
  navigation, the user's identity and sign-out, and a bar over the page with
  the theme toggle. Below 48rem the sidebar becomes a sheet behind the bar's
  toggle. The sign-out is a plain form post, so it works before scripts load.
  Sidebar state persists in the `sidebar_state` cookie, which the layout load
  reads back (`sidebarOpen`), so a reload keeps it without a flash.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import VmbLogo from "$lib/components/VmbLogo.svelte";
  import { isCurrent, NAV_GROUPS, visibleGroups, type NavIcon } from "$lib/nav.js";
  import Building2 from "@lucide/svelte/icons/building-2";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Users from "@lucide/svelte/icons/users";
  import type { Snippet } from "svelte";

  let {
    user,
    division,
    sidebarOpen,
    children
  }: {
    user: { name: string; email: string };
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

  // Up to two initials, for the avatar. The name itself is shown beside it.
  const initials = $derived(
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("")
  );
</script>

<a
  href="#main-content"
  class="bg-background text-foreground focus-visible:ring-ring sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:ring-2 focus-visible:outline-none"
>
  Skip to content
</a>

<Sidebar.Provider open={sidebarOpen}>
  <Sidebar.Root variant="inset" collapsible="icon">
    <Sidebar.Header>
      <a
        href={resolve("/")}
        class="focus-visible:ring-sidebar-ring flex h-10 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:outline-none"
      >
        <VmbLogo class="h-9 group-data-[collapsible=icon]:h-6" title="VMB, go to the dashboard" />
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

    <Sidebar.Footer>
      <div class="flex items-center gap-2 overflow-hidden rounded-md p-2">
        <span
          aria-hidden="true"
          class="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
        >
          {initials}
        </span>
        <div class="grid min-w-0 flex-1 text-sm leading-tight group-data-[collapsible=icon]:hidden">
          <span class="truncate font-medium">{user.name}</span>
          <span class="text-sidebar-foreground/70 flex items-center gap-1 truncate text-xs">
            {#if division}
              <HeroIcon name={division.iconName} class="size-3 shrink-0" />
              <span class="truncate">{division.name}</span>
            {:else}
              <span class="truncate">No division</span>
            {/if}
          </span>
        </div>
      </div>
      <form method="POST" action={resolve("/logout")}>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton tooltipContent="Log out" class="pointer-coarse:h-11">
              {#snippet child({ props })}
                <button {...props} type="submit">
                  <LogOut aria-hidden="true" />
                  <span>Log out</span>
                </button>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </form>
    </Sidebar.Footer>
  </Sidebar.Root>

  <Sidebar.Inset id="main-content" tabindex={-1} class="min-w-0 outline-none">
    <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Sidebar.Trigger class="pointer-coarse:size-11" />
      <!-- The sidebar, and its logo, sit behind the toggle on a phone. -->
      <a
        href={resolve("/")}
        class="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none md:hidden"
      >
        <VmbLogo class="h-8" title="VMB, go to the dashboard" />
      </a>
      <ThemeToggle class="-mr-2 ml-auto" />
    </header>
    <div class="flex-1 p-4 sm:p-6">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
