<!--
  The top half of a list's card (#301, #363; ADR-0051 rules 2, 3 and 5): the
  views as tabs on the card's top edge with their counts, then the search, the
  Filter button and the list's own actions (the columns menu) beside them, and
  under them a strip of chips for the filters in use. Put it first inside the
  card.

  The card answers to its own width, not the window's: wider than 48rem
  everything shares one row; narrower, the controls drop under the tabs and a
  hairline runs under the tabs. On a phone the chips move into a sheet behind a
  "Filters" button that counts them.
-->
<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import type { MasterListPathname } from "$lib/master/list.js";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import type { Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import FilterChips, {
    activeFilters,
    hasActiveFilters,
    type ListFilter
  } from "./FilterChips.svelte";
  import FilterMenu from "./FilterMenu.svelte";
  import ListSearch from "./ListSearch.svelte";
  import ListTabs from "./ListTabs.svelte";

  let {
    base,
    viewsLabel,
    countNoun,
    views,
    searchLabel,
    searchPlaceholder,
    searchShortPlaceholder,
    filters,
    actions
  }: {
    base: MasterListPathname;
    /** Names the tabs for a screen reader: "Division views". */
    viewsLabel: string;
    /** What the tabs' counts count: "divisions". */
    countNoun: string;
    /** Rows in each view under the current search and filters; null when the list failed to load. */
    views: { all: number; trash: number } | null;
    searchLabel: string;
    /** Names the matched fields: "Search name, code or description". */
    searchPlaceholder: string;
    /** Used when the field is too narrow for `searchPlaceholder`: "Search divisions". */
    searchShortPlaceholder: string;
    filters: readonly ListFilter[];
    actions?: Snippet;
  } = $props();

  let filterOpen = $state(false);
  let sheetOpen = $state(false);
  // the sheet is the phone's view of the chips; widened past `sm`, the chips are back on the strip
  const wide = new MediaQuery("min-width: 40rem");
  $effect(() => {
    if (wide.current) sheetOpen = false;
  });
  const activeCount = $derived(activeFilters(filters, page.url.searchParams).length);
  const anyActive = $derived(hasActiveFilters(filters, page.url.searchParams));
</script>

<div class="@container/list">
  <div class="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3">
    <ListTabs
      {base}
      label={viewsLabel}
      {views}
      {countNoun}
      class="@max-3xl/list:-mx-3 @max-3xl/list:mb-0 @max-3xl/list:w-[calc(100%+1.5rem)] @max-3xl/list:px-3 @max-3xl/list:shadow-[inset_0_-1px_0_var(--border)]"
    />
    <div class="ml-auto flex items-center gap-2 py-2 max-sm:w-full @max-3xl/list:w-full">
      <ListSearch
        {base}
        label={searchLabel}
        placeholder={searchPlaceholder}
        shortPlaceholder={searchShortPlaceholder}
        class="flex-1 @3xl/list:w-80 @3xl/list:flex-none"
      />
      <FilterMenu {base} {filters} bind:open={filterOpen} class="max-sm:hidden" />

      <Sheet.Root bind:open={sheetOpen}>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <Button {...props} data-slot="button" variant="outline" class="sm:hidden">
              <SlidersHorizontalIcon aria-hidden="true" data-icon="inline-start" />Filters
              {#if activeCount > 0}
                <span
                  class="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-xs tabular-nums"
                  >{activeCount}</span
                ><span class="sr-only">active</span>
              {/if}
            </Button>
          {/snippet}
        </Sheet.Trigger>
        <Sheet.Content side="bottom" class="rounded-t-xl">
          <Sheet.Header>
            <Sheet.Title>Filters</Sheet.Title>
            <Sheet.Description
              >Each filter narrows the list; remove one to widen it.</Sheet.Description
            >
          </Sheet.Header>
          <div class="flex flex-col items-start gap-3 px-4 pb-6">
            <FilterChips {base} {filters} withSearch={false} withClearAll={false} />
            <FilterMenu {base} {filters} label="Add filter" class="border-dashed" />
          </div>
        </Sheet.Content>
      </Sheet.Root>

      {@render actions?.()}
    </div>
  </div>

  {#if anyActive}
    <div class="bg-muted/40 border-border hidden border-b px-3 py-2 sm:block">
      <FilterChips {base} {filters} onopen={() => (filterOpen = true)} />
    </div>
  {/if}
</div>
