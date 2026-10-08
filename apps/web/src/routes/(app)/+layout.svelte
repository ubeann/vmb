<!--
  Every signed-in screen lives in this group, inside the app shell (#167). The
  gate in hooks.server.ts has already refused anyone without a session, so the
  `user` guard only narrows the type; the signed-out pages and the error page
  keep their own frames. From 48rem up the shell's panel scrolls, not the
  window, so the snapshot keeps its place for back, forward and a reload, as
  SvelteKit does for the window.
-->
<script lang="ts">
  import AppShell from "$lib/components/AppShell.svelte";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import type { Snippet } from "svelte";
  import type { LayoutData, Snapshot } from "./$types.js";

  let { children, data }: { children: Snippet; data: LayoutData } = $props();

  let panel = $state<HTMLElement | null>(null);

  export const snapshot: Snapshot<number> = {
    capture: () => panel?.scrollTop ?? 0,
    restore: (top) => {
      if (panel) panel.scrollTop = top;
    }
  };
</script>

<!-- One toaster for every signed-in screen, so a list's Undo outlives a navigation. -->
<Toaster richColors closeButton />

{#if data.user}
  <AppShell user={data.user} division={data.division} sidebarOpen={data.sidebarOpen} bind:panel>
    {@render children()}
  </AppShell>
{:else}
  {@render children()}
{/if}
