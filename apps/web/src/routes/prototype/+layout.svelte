<!-- PROTOTYPE (prototype/list-kit): the real app shell around the throwaway routes, with a stand-in user. -->
<script lang="ts">
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
</script>

<Toaster richColors closeButton />

<AppShell {user} division={null} sidebarOpen={true}>
  {@render children()}
</AppShell>
