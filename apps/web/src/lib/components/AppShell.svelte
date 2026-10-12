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
  import { trailFor, type RecordCrumb } from "$lib/breadcrumbs.js";
  import VmbLogo from "$lib/components/VmbLogo.svelte";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import { isCurrent, NAV_GROUPS, visibleGroups } from "$lib/nav.js";
  import { NAV_ICONS } from "$lib/nav-icons.js";
  import { onMount, type Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";

  let {
    user,
    division,
    sidebarOpen,
    sidebarSaved,
    panel = $bindable(null),
    footerAt = "pinned",
    crumbs = "bar",
    trailPath,
    trailRecord,
    children
  }: {
    user: { id: string; name: string; email: string; image?: string | null };
    division: { name: string; iconName: string } | null;
    sidebarOpen: boolean;
    /** Whether `sidebarOpen` is the user's own saved choice, rather than the default. */
    sidebarSaved: boolean;
    /** The scrolling panel, for the layout's snapshot to keep its place across history. */
    panel?: HTMLElement | null;
    /**
     * PROTOTYPE (prototype/divisions): where the footer strip sits from 48rem up. `pinned`
     * is today's, below the scrolling panel; `inPanel` scrolls it in at the end of the
     * panel; `afterPanel` lets the window scroll, so it follows the panel on the frame.
     */
    footerAt?: "pinned" | "inPanel" | "afterPanel";
    /**
     * PROTOTYPE (prototype/divisions): what the bar shows beside the menu button below 48rem.
     * `bar` is today's (the section's crumb); `back` is the logo on a section's own page and
     * "‹ Section" below it; `page` is the logo, with the trail above the page's heading;
     * `none` is the logo alone, leaving the way back to the gesture and the page's own link;
     * `bare` drops the logo too, since the sidebar's sheet carries it.
     */
    crumbs?: "bar" | "back" | "page" | "none" | "bare";
    /** PROTOTYPE: the path and record the trail is read from, for a route outside the nav. */
    trailPath?: string;
    trailRecord?: RecordCrumb;
    children: Snippet;
  } = $props();

  const groups = visibleGroups(NAV_GROUPS);

  // The user's toggle, once there is one: it wins over the tablet default from then on.
  let chosen = $state<boolean | null>(null);
  const tablet = new MediaQuery("(min-width: 640px) and (max-width: 1023.98px)");
  let mounted = $state(false);
  onMount(() => (mounted = true));
  const open = $derived(chosen ?? (sidebarSaved ? sidebarOpen : !(mounted && tablet.current)));

  const trail = $derived(
    trailFor(trailPath ?? page.url.pathname, trailRecord ?? page.data.crumb, groups)
  );
  // PROTOTYPE: the section a record's page goes back to, and the crumbs above the current one
  const parent = $derived(trail.find((crumb) => crumb.section && crumb.href));
  const ancestors = $derived(trail.filter((crumb) => !crumb.current));

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
  {open}
  onOpenChange={(next) => (chosen = next)}
  data-footer-at={footerAt}
  class="[--header-height:3.5rem] sm:[--header-height:4rem] md:[--header-height:4.5rem]"
>
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
    class="md:peer-folded:[&>[data-slot=sidebar-inset]]:ml-2 md:peer-folded:[&>[data-slot=sidebar-inset]]:duration-(--duration-exit) flex min-w-0 flex-1 flex-col {footerAt ===
    'pinned'
      ? 'md:h-svh'
      : 'min-h-svh'}"
  >
    <header
      data-scrolled={scrollY > 0}
      class="bg-sidebar text-sidebar-foreground max-md:border-sidebar-border sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 px-3 transition-shadow duration-(--duration-panel) ease-(--easing-standard) max-md:border-b max-md:data-[scrolled=true]:shadow-sm sm:px-4"
    >
      <SidebarToggle />
      {#if crumbs === "bar"}
        <AppBreadcrumbs {trail} />
      {:else}
        <div class="min-w-0 max-md:hidden"><AppBreadcrumbs {trail} /></div>
        {#if crumbs === "back" && parent?.href}
          <a
            href={resolve(parent.href as "/")}
            class="focus-visible:ring-ring -ml-1 flex min-w-0 items-center gap-0.5 rounded-md py-2 pr-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none md:hidden"
          >
            <ChevronLeftIcon class="size-5 shrink-0" aria-hidden="true" />
            <span class="truncate">{parent.label}</span>
          </a>
        {:else if crumbs !== "bare"}
          <a
            href={resolve("/")}
            class="focus-visible:ring-ring flex items-center rounded-md focus-visible:ring-2 focus-visible:outline-none md:hidden"
          >
            <VmbLogo class="h-7" title="VMB, go to the dashboard" />
          </a>
        {/if}
      {/if}
      <div class="ml-auto shrink-0">
        <ProfileMenu {user} {division} />
      </div>
    </header>

    <!-- `w-auto` replaces the inset's `w-full`, which with the panel's margins would overflow.
         The panel scrolls wide content itself on a phone, and from 48rem up tall content
         too, between the bar and the footer; `*:shrink-0` keeps its column from squeezing
         a child (one with `overflow-hidden` has no content floor) instead of scrolling.
         A page caps and centres its own content with `Page` (ADR-0050), so the panel
         stays full width. In light mode the panel is a white sheet on the warm frame,
         so the page is two layers and its tables sit on the same white (ADR-0036,
         "Signed-in panel"); dark mode keeps the background, since its card is the
         sidebar's colour and would merge the panel into the frame. -->
    <Sidebar.Inset
      bind:ref={panel}
      id="main-content"
      tabindex={-1}
      class="bg-card dark:bg-background w-auto min-w-0 overflow-x-auto p-4 transition-[margin-left] duration-(--duration-panel) ease-(--easing-standard) outline-none md:m-2 md:mt-0 md:ml-0 md:rounded-xl md:shadow-sm md:*:shrink-0 lg:p-6 {footerAt ===
      'afterPanel'
        ? ''
        : 'md:min-h-0 md:overflow-y-auto'}"
    >
      {#if crumbs === "page" && ancestors.length > 0}
        <!-- PROTOTYPE: the trail above the heading, without the page it names -->
        <div class="text-muted-foreground mb-2 text-sm md:hidden">
          <AppBreadcrumbs trail={ancestors} full />
        </div>
      {/if}
      {@render children()}
      {#if footerAt === "inPanel"}
        <!-- PROTOTYPE: pushed to the panel's foot on a short page, after the content on a long one -->
        <div class="mt-auto pt-6">
          <SiteFooter class="max-w-none px-0 pt-3 pb-0 sm:px-0 lg:px-0" />
        </div>
      {/if}
    </Sidebar.Inset>

    <!-- Below the panel, not inside it, so it stays the page's contentinfo landmark.
         It sits on the sidebar's colour. From tablet up it takes 8px on the left and
         12px on the right; the phone keeps the panel's 16px. `sm:px-3` and `lg:px-3`
         beat SiteFooter's own `sm:px-10 lg:px-16`. -->
    {#if footerAt !== "inPanel"}
      <SiteFooter class="max-w-none px-4 pt-2 pb-3 sm:px-3 sm:pl-2 lg:px-3 lg:pl-2" />
    {/if}
  </div>
</Sidebar.Provider>

<ShortcutsSheet />

<style>
  /* PROTOTYPE (prototype/divisions): when the window scrolls, a bounce past either end (macOS,
     iPadOS) shows the page's canvas, which takes the body's background unless the root has its
     own. Painting the root in the frame's colour makes the bounce read as more frame. */
  :global(html:has([data-footer-at="afterPanel"])) {
    background-color: var(--sidebar);
  }
</style>
