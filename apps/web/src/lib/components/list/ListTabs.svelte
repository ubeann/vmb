<!--
  The All · Trash views on the card's top edge (#301, #363). Each tab is a link
  that sets or clears `trashed=only`, keeping the search and filters, and says
  how many rows it would show: the counts follow the search and filters
  (ADR-0051 rule 2). A count is read with what it counts, and the Trash's is
  "deleted divisions" so it isn't heard as the same thing as All's.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { listHref, nounFor, type CountNoun, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";

  let {
    base,
    label,
    views,
    countNouns,
    class: className = ""
  }: {
    base: MasterListPathname;
    label: string;
    /** Rows in each view; null when the list could not be loaded. */
    views: { all: number; trash: number } | null;
    /** What each count counts, read after it by a screen reader: "divisions" and "deleted divisions". */
    countNouns: { all: CountNoun; trash: CountNoun };
    class?: string;
  } = $props();

  const inTrash = $derived(page.url.searchParams.get("trashed") === "only");
  const tabs = $derived([
    {
      name: "All",
      count: views?.all ?? null,
      noun: countNouns.all,
      current: !inTrash,
      trashed: null
    },
    {
      name: "Trash",
      count: views?.trash ?? null,
      noun: countNouns.trash,
      current: inTrash,
      trashed: "only"
    }
  ]);
</script>

<nav aria-label={label} class={cn("-mb-px flex items-center gap-4 self-stretch", className)}>
  {#each tabs as tab (tab.name)}
    <a
      href={resolve(listHref(base, page.url.searchParams, { trashed: tab.trashed }))}
      aria-current={tab.current ? "page" : undefined}
      data-sveltekit-noscroll
      class={cn(
        "focus-visible:ring-ring inline-flex h-12 items-center gap-1.5 border-b-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none",
        tab.current
          ? "border-foreground text-foreground"
          : "text-muted-foreground hover:text-foreground border-transparent"
      )}
    >
      {tab.name}
      {#if tab.count !== null}
        <span class="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums"
          >{tab.count}</span
        ><span class="sr-only">{nounFor(tab.noun, tab.count)}</span>
      {/if}
    </a>
  {/each}
</nav>
