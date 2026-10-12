<!-- PROTOTYPE (prototype/divisions): the real app shell around the throwaway routes, with a stand-in user. -->
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
  // which variant moves the footer (the page itself is today's in each)
  const FOOTER = { B: "inPanel", C: "afterPanel" } as const;
  const footerAt = $derived(
    FOOTER[page.url.searchParams.get("variant") as keyof typeof FOOTER] ?? "pinned"
  );
</script>

<Toaster richColors closeButton />

<AppShell {user} division={null} sidebarOpen={true} sidebarSaved={false} {footerAt}>
  {@render children()}
</AppShell>
