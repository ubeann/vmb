<script lang="ts" module>
  import { splitListParam } from "@vmb/types";
  import type { Component } from "svelte";

  /** A filter a list offers: one URL parameter, and the values it may take. */
  export type ListFilter = {
    key: string;
    label: string;
    icon?: Component;
    options: readonly { value: string; label: string }[];
  };

  /** The date filters every list has (ADR-0051 rule 4), whether or not a chip shows them yet. */
  export const DATE_FILTER_KEYS = ["updated", "created"] as const;

  /**
   * The filters the URL has set to values the list offers, with those values'
   * labels in the order the list offers them. A value filter holds several
   * (`status=active,inactive`).
   */
  export function activeFilters(filters: readonly ListFilter[], params: URLSearchParams) {
    return filters.flatMap((filter) => {
      const picked = splitListParam(params.get(filter.key) ?? "");
      const options = filter.options.filter(({ value }) => picked.includes(value));
      return options.length > 0
        ? [{ filter, options, text: options.map(({ label }) => label).join(", ") }]
        : [];
    });
  }

  /** Whether the URL holds a search or any filter, so a strip of chips has something to show. */
  export function hasActiveFilters(filters: readonly ListFilter[], params: URLSearchParams) {
    return (
      Boolean(params.get("search")) ||
      activeFilters(filters, params).length > 0 ||
      DATE_FILTER_KEYS.some((key) => params.has(key))
    );
  }
</script>

<!--
  The filters in use as chips on a strip under the toolbar, the search as a
  chip too (ADR-0051 rule 5, #363). A chip is the filter's icon, its name and
  its value on a light green tint: its body calls `onopen` to open the filter
  control, its × drops the filter. "Clear all" is a quiet button after the last
  chip, and clears the search with the filters. Every × and Clear all is a link
  to the list with those parameters removed, so the browser's history, a copied
  URL and the no-JavaScript list all agree.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";

  let {
    base,
    filters,
    onopen,
    withSearch = true,
    withClearAll = true,
    class: className = ""
  }: {
    base: MasterListPathname;
    filters: readonly ListFilter[];
    /** Opens the filter control from a chip; without it a chip is only a label. */
    onopen?: () => void;
    /** Show the search as a chip. */
    withSearch?: boolean;
    /** Show "Clear all" after the last chip. */
    withClearAll?: boolean;
    class?: string;
  } = $props();

  const active = $derived(activeFilters(filters, page.url.searchParams));
  const search = $derived(withSearch ? (page.url.searchParams.get("search") ?? "") : "");
  const clearAll = $derived(
    listHref(
      base,
      page.url.searchParams,
      Object.fromEntries(
        ["search", ...filters.map(({ key }) => key), ...DATE_FILTER_KEYS].map((key) => [key, null])
      )
    )
  );

  const chip =
    "bg-primary/10 ring-primary/30 text-foreground dark:bg-primary/15 inline-flex h-8 items-stretch overflow-hidden rounded-(--control-radius) text-sm ring-1 ring-inset pointer-coarse:h-11";
  const part =
    "hover:bg-primary/10 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset";
  const remove =
    "border-primary/25 hover:bg-primary/10 focus-visible:ring-ring inline-flex w-7 items-center justify-center border-l focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset pointer-coarse:w-11";
</script>

<ul class={cn("flex flex-wrap items-center gap-2", className)} aria-label="Filters in use">
  {#if search}
    <li class={chip}>
      <button
        type="button"
        data-slot="filter-chip"
        class={cn("inline-flex max-w-64 items-center gap-1.5 px-2 font-medium", part)}
        onclick={() => document.querySelector<HTMLInputElement>("input[type=search]")?.focus()}
      >
        <SearchIcon aria-hidden="true" class="text-primary size-4 shrink-0" />
        <span class="text-muted-foreground font-normal">Search</span>
        <span class="truncate">“{search}”</span>
      </button>
      <a
        href={resolve(listHref(base, page.url.searchParams, { search: null }))}
        data-sveltekit-noscroll
        aria-label="Clear the search"
        class={remove}><XIcon aria-hidden="true" class="size-3.5" /></a
      >
    </li>
  {/if}

  {#each active as { filter, text } (filter.key)}
    <li class={chip}>
      {#snippet body()}
        {#if filter.icon}<filter.icon
            aria-hidden="true"
            class="text-primary size-4 shrink-0"
          />{/if}
        <span class="text-muted-foreground font-normal">{filter.label}</span>
        <span class="truncate">{text}</span>
      {/snippet}
      {#if onopen}
        <button
          type="button"
          data-slot="filter-chip"
          class={cn("inline-flex max-w-64 items-center gap-1.5 px-2 font-medium", part)}
          onclick={onopen}>{@render body()}</button
        >
      {:else}
        <span class="inline-flex max-w-64 items-center gap-1.5 px-2 font-medium"
          >{@render body()}</span
        >
      {/if}
      <a
        href={resolve(listHref(base, page.url.searchParams, { [filter.key]: null }))}
        data-sveltekit-noscroll
        aria-label="Remove filter {filter.label}: {text}"
        class={remove}><XIcon aria-hidden="true" class="size-3.5" /></a
      >
    </li>
  {/each}

  {#if withClearAll && hasActiveFilters(filters, page.url.searchParams)}
    <li>
      <a
        href={resolve(clearAll)}
        data-sveltekit-noscroll
        data-slot="button"
        class={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>Clear all</a
      >
    </li>
  {/if}
</ul>
