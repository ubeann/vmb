<!--
  The top half of a list's card (#301, #363, #365; ADR-0051 rules 2, 3, 4 and
  5): the views as tabs on the card's top edge with their counts, then the
  search, the Filter button and the list's own actions (the columns menu)
  beside them, and under them a strip of chips for the filters in use. Put it
  first inside the card.

  The card (`ListCard`) answers to its own width, not the window's: wider than 48rem
  everything shares one row; narrower, the controls drop under the tabs and a
  hairline runs under the tabs. The Filter button opens the Filter panel, a
  bottom sheet on a phone; the strip of chips shows from 640px, and a chip opens
  the panel at its filter. Under 640px the button's count and the panel itself
  say what is filtered.
-->
<script lang="ts">
  import { nounFor, type CountNoun, type MasterListPathname } from "$lib/master/list.js";
  import type { Snippet } from "svelte";
  import { readerToday } from "./dates.js";
  import FilterChips, { hasActiveFilters, type ListFilter } from "./FilterChips.svelte";
  import FilterPanel from "./FilterPanel.svelte";
  import ListSearch from "./ListSearch.svelte";
  import ListTabs from "./ListTabs.svelte";
  import { listPage } from "./list-url.svelte.js";

  // the list's URL, which a record layer over it leaves in place (#302)
  const page = listPage();

  let {
    base,
    viewsLabel,
    countNouns,
    views,
    searchLabel,
    searchPlaceholder,
    searchShortPlaceholder,
    filters,
    facets = null,
    actions
  }: {
    base: MasterListPathname;
    /** Names the tabs for a screen reader: "Division views". */
    viewsLabel: string;
    /** What the tabs' counts count: "divisions" and "deleted divisions". */
    countNouns: { all: CountNoun; trash: CountNoun };
    /** Rows in each view under the current search and filters; null when the list failed to load. */
    views: { all: number; trash: number } | null;
    searchLabel: string;
    /** Names the matched fields: "Search name, code or description". */
    searchPlaceholder: string;
    /** Used when the field is too narrow for `searchPlaceholder`: "Search divisions". */
    searchShortPlaceholder: string;
    filters: readonly ListFilter[];
    /** For each value filter, the rows each option would give (the list response's `facets`). */
    facets?: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
    actions?: Snippet;
  } = $props();

  let panel = $state<ReturnType<typeof FilterPanel>>();
  const anyActive = $derived(hasActiveFilters(filters, page.url.searchParams, readerToday()));
  // the rows the panel's main action says it shows, and what they are: the view the list is in
  const inTrash = $derived(page.url.searchParams.get("trashed") === "only");
  const shown = $derived(views ? (inTrash ? views.trash : views.all) : null);
  const noun = $derived(inTrash ? countNouns.trash : countNouns.all);
  // the list's name on the shortcut sheet: "Divisions"
  const listName = $derived.by(() => {
    const name = nounFor(countNouns.all, 2);
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
</script>

<div>
  <div class="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3">
    <ListTabs
      {base}
      label={viewsLabel}
      {views}
      {countNouns}
      class="@max-3xl/list:-mx-3 @max-3xl/list:mb-0 @max-3xl/list:w-[calc(100%+1.5rem)] @max-3xl/list:px-3 @max-3xl/list:shadow-[inset_0_-1px_0_var(--border)]"
    />
    <div class="ml-auto flex items-center gap-2 py-2 max-sm:w-full @max-3xl/list:w-full">
      <ListSearch
        {base}
        label={searchLabel}
        placeholder={searchPlaceholder}
        shortPlaceholder={searchShortPlaceholder}
        {listName}
        class="flex-1 @3xl/list:w-80 @3xl/list:flex-none"
      />
      <FilterPanel bind:this={panel} {base} {filters} {facets} {shown} {noun} />

      {@render actions?.()}
    </div>
  </div>

  {#if anyActive}
    <div class="bg-muted/40 border-border hidden border-b px-3 py-2 sm:block">
      <FilterChips {base} {filters} onopen={(key) => panel?.show(key)} />
    </div>
  {/if}
</div>
