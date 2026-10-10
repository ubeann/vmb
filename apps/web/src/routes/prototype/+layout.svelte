<!-- PROTOTYPE (prototype/list-kit): the real app shell around the throwaway routes, with a stand-in user. -->
<script lang="ts">
  import { page } from "$app/state";
  import AppShell from "$lib/components/AppShell.svelte";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
  const user = {
    id: "prototype",
    name: "Preview User",
    email: "preview@vmblogistics.id",
    image: null
  };
  // Round 20 (C3q): under 1024px the sidebar starts as its icon rail, giving the page ~200px
  let innerWidth = $state(1440);
  const rail = $derived(
    ["C3q", "C3k"].includes(page.url.searchParams.get("variant") ?? "") && innerWidth < 1024
  );
</script>

<Toaster richColors closeButton />

<svelte:window bind:innerWidth />

<AppShell {user} division={null} sidebarOpen={!rail}>
  {@render children()}
</AppShell>
