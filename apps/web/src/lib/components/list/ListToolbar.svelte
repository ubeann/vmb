<!--
  The bar above a list (#301): search, the filter chips, and the list's own
  actions (the columns menu, "New …") at the end. On a narrow screen the
  search takes the full width and the chips move into a sheet behind a
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
  import FilterChips, { activeFilters, type ListFilter } from "./FilterChips.svelte";
  import ListSearch from "./ListSearch.svelte";

  let {
    base,
    searchLabel,
    filters,
    actions
  }: {
    base: MasterListPathname;
    searchLabel: string;
    filters: readonly ListFilter[];
    actions?: Snippet;
  } = $props();

  let sheetOpen = $state(false);
  // the sheet is the narrow screen's view of the chips; widened past `sm`, the chips are back in the bar
  const wide = new MediaQuery("min-width: 40rem");
  $effect(() => {
    if (wide.current) sheetOpen = false;
  });
  const activeCount = $derived(activeFilters(filters, page.url.searchParams).length);
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
  <ListSearch {base} label={searchLabel} class="w-full sm:w-72" />

  <FilterChips {base} {filters} class="hidden flex-1 sm:flex" />

  <div class="flex items-center gap-2 sm:ml-auto">
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
        <FilterChips {base} {filters} class="px-4 pb-6" />
      </Sheet.Content>
    </Sheet.Root>

    {@render actions?.()}
  </div>
</div>
