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
  const FOOTER = {
    B: "inPanel",
    C: "afterPanel",
    D: "afterPanel",
    E: "afterPanel",
    F: "afterPanel",
    G: "afterPanel",
    H: "afterPanel"
  } as const;
  const footerAt = $derived(
    FOOTER[page.url.searchParams.get("variant") as keyof typeof FOOTER] ?? "pinned"
  );
  // round 3: E to H try the bar below 48rem; `?at=record` reads the trail as a record's page
  const CRUMBS = { E: "back", F: "page", G: "none", H: "bare" } as const;
  const crumbs = $derived(
    CRUMBS[page.url.searchParams.get("variant") as keyof typeof CRUMBS] ?? "bar"
  );
  const atRecord = $derived(page.url.searchParams.get("at") === "record");
</script>

<Toaster richColors closeButton />

<AppShell
  {user}
  division={null}
  sidebarOpen={true}
  sidebarSaved={false}
  {footerAt}
  {crumbs}
  trailPath={atRecord
    ? "/master/divisions/00000000-0000-4000-8000-000000000002"
    : "/master/divisions"}
  trailRecord={atRecord
    ? { label: "Finance", tile: { iconName: "heroicon-o-banknotes", colorHex: "#16A34A" } }
    : undefined}
>
  {@render children()}
</AppShell>
