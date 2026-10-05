<!--
  The app's sidebar (#167). It runs the full height of the window, with the
  VMB mark in its top cell, the navigation under it and the collapse button at
  its foot.

  Collapsed, it is a rail of icons. Resting the pointer on the rail, or tabbing
  into it, "peeks": the panel opens over the page to show the labels, and the
  page does not move. The peek is not the saved state; the button at the foot
  pins the sidebar open or collapsed, and that is what the cookie keeps. Touch
  has no hover, so a touch pointer never peeks. Esc closes a peek.

  This is the vendored sidebar's desktop branch, with the peek added: the
  vendored parts style their collapsed look off `data-collapsible` on the
  group, so a peek simply drops that attribute while `data-state` and the gap
  that holds the page's place keep following the saved state. Below 48rem the
  vendored sheet takes over, with the logo and the navigation and no foot.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import VmbLogo from "$lib/components/VmbLogo.svelte";
  import { duration } from "$lib/motion.js";
  import PanelLeftClose from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpen from "@lucide/svelte/icons/panel-left-open";
  import type { Snippet } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";

  let { children }: { children: Snippet } = $props();

  const sidebar = Sidebar.useSidebar();

  // How long the pointer rests before the rail opens, and how long it may stray
  // before the rail closes again, so a pass across the edge doesn't flash it.
  const OPEN_DELAY = 120;
  const CLOSE_DELAY = 200;

  let hovering = $state(false);
  let focused = $state(false);
  // After the foot button is clicked, the rail waits for the pointer to leave
  // before it may peek again; otherwise collapsing would look like nothing happened.
  let settling = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const peeking = $derived(sidebar.state === "collapsed" && (hovering || focused));

  // Collapsing slides the panel shut while the buttons keep their full width,
  // so the labels are clipped by the closing edge instead of snapping away at
  // the start (`data-closing`, which app.css reads). Expanding needs none of it.
  const narrow = $derived(sidebar.state === "collapsed" && !peeking);
  let closing = $state(false);
  $effect(() => {
    if (!narrow || prefersReducedMotion.current) {
      closing = false;
      return;
    }
    closing = true;
    const done = setTimeout(() => (closing = false), duration.exit);
    return () => clearTimeout(done);
  });

  function hover(next: boolean) {
    clearTimeout(timer);
    if (next && settling) return;
    timer = setTimeout(() => (hovering = next), next ? OPEN_DELAY : CLOSE_DELAY);
  }

  function enter(event: PointerEvent) {
    if (event.pointerType !== "touch") hover(true);
  }

  function leave() {
    settling = false;
    hover(false);
  }

  // Only keyboard focus peeks: a click focuses a link too, and the rail must
  // not stay open behind a pointer that has left.
  function focusIn(event: FocusEvent) {
    if ((event.target as Element).matches(":focus-visible")) focused = true;
  }

  function focusOut(event: FocusEvent) {
    if (!(event.currentTarget as Element).contains(event.relatedTarget as Node | null)) {
      focused = false;
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !peeking) return;
    clearTimeout(timer);
    hovering = false;
    focused = false;
  }

  function toggle() {
    clearTimeout(timer);
    hovering = false;
    settling = true;
    sidebar.toggle();
  }
</script>

{#snippet logo()}
  <!-- Anchored left in both looks (5px puts the collapsed mark at the middle of the
       rail), so the mark never swings across the panel while it narrows. -->
  <a
    href={resolve("/")}
    class="focus-visible:ring-sidebar-ring flex h-10 items-center rounded-md pr-2 pl-4 transition-[padding] duration-(--duration-panel) ease-(--easing-standard) group-data-[collapsible=icon]:pr-0 group-data-[collapsible=icon]:pl-[5px] group-data-[collapsible=icon]:duration-(--duration-exit) focus-visible:ring-2 focus-visible:outline-none"
  >
    <VmbLogo
      class="h-8 transition-[height] duration-(--duration-panel) ease-(--easing-standard) group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:duration-(--duration-exit)"
      title="VMB, go to the dashboard"
    />
  </a>
{/snippet}

{#if sidebar.isMobile}
  <Sidebar.Root variant="inset" collapsible="icon">
    <Sidebar.Header>{@render logo()}</Sidebar.Header>
    <Sidebar.Content>{@render children()}</Sidebar.Content>
  </Sidebar.Root>
{:else}
  <div
    class="group peer text-sidebar-foreground hidden md:block"
    data-state={sidebar.state}
    data-collapsible={narrow ? "icon" : ""}
    data-variant="inset"
    data-side="left"
    data-slot="sidebar"
  >
    <!-- Holds the page's place; it follows the saved state, never the peek. -->
    <div
      data-slot="sidebar-gap"
      class="relative w-(--sidebar-width) bg-transparent transition-[width] duration-(--duration-panel) ease-(--easing-standard) group-data-[state=collapsed]:w-[calc(var(--sidebar-width-icon)+--spacing(4))] group-data-[state=collapsed]:duration-(--duration-exit)"
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      data-slot="sidebar-container"
      data-side="left"
      data-peek={peeking}
      data-narrow={narrow}
      data-closing={closing}
      class="fixed inset-y-0 start-0 z-30 hidden h-svh w-(--sidebar-width) p-2 transition-[width] duration-(--duration-panel) ease-(--easing-standard) data-[narrow=true]:w-[calc(var(--sidebar-width-icon)+--spacing(4)+2px)] data-[narrow=true]:duration-(--duration-exit) md:flex"
      onpointerenter={enter}
      onpointerleave={leave}
      onfocusin={focusIn}
      onfocusout={focusOut}
      onkeydown={keydown}
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        data-peek={peeking}
        class="bg-sidebar data-[peek=true]:ring-sidebar-border flex size-full flex-col overflow-hidden rounded-xl transition-shadow duration-(--duration-panel) data-[peek=true]:shadow-[10px_0_36px_-6px_rgb(0_0_0/0.22),0_12px_28px_-10px_rgb(0_0_0/0.2)] data-[peek=true]:ring-1 dark:data-[peek=true]:shadow-[10px_0_36px_-6px_rgb(0_0_0/0.6),0_12px_28px_-10px_rgb(0_0_0/0.5)]"
      >
        <Sidebar.Header class="h-[calc(var(--header-height)-1rem)] justify-center p-0">
          {@render logo()}
        </Sidebar.Header>

        <Sidebar.Content>{@render children()}</Sidebar.Content>

        <Sidebar.Footer>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                class="pointer-coarse:h-11"
                aria-label={sidebar.open ? "Collapse sidebar" : "Expand sidebar"}
                aria-expanded={sidebar.open}
                aria-keyshortcuts="Control+B Meta+B"
                onclick={toggle}
              >
                {#if sidebar.open}
                  <PanelLeftClose aria-hidden="true" />
                {:else}
                  <PanelLeftOpen aria-hidden="true" />
                {/if}
                <span>{sidebar.open ? "Collapse" : "Expand"}</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Footer>
      </div>
    </div>
  </div>
{/if}
