<!--
  The All · Trash switch above a list (#301), replacing the old "Trashed"
  select. Each tab is a link that sets or clears `trashed=only`, keeping the
  search and filters, and the Trash tab says how many records it holds.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";

  let {
    base,
    label,
    trashCount,
    countNoun
  }: {
    base: MasterListPathname;
    label: string;
    trashCount: number | null;
    /** What the count counts, read after it by a screen reader: "divisions". */
    countNoun: string;
  } = $props();

  const inTrash = $derived(page.url.searchParams.get("trashed") === "only");
  const tabs = $derived([
    { name: "All", count: null, current: !inTrash, trashed: null },
    { name: "Trash", count: trashCount, current: inTrash, trashed: "only" }
  ]);
</script>

<nav aria-label={label} class="border-border flex gap-1 border-b">
  {#each tabs as tab (tab.name)}
    <a
      href={resolve(listHref(base, page.url.searchParams, { trashed: tab.trashed }))}
      aria-current={tab.current ? "page" : undefined}
      data-sveltekit-noscroll
      class={cn(
        "focus-visible:ring-ring -mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none pointer-coarse:h-11",
        tab.current
          ? "border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground border-transparent"
      )}
    >
      {tab.name}
      {#if tab.count !== null}
        <span class="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums"
          >{tab.count}</span
        ><span class="sr-only">{countNoun}</span>
      {/if}
    </a>
  {/each}
</nav>
