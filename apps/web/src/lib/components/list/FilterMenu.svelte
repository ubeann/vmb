<!--
  The Filter button (#363): one menu with a section per filter and a checkbox
  per value. A choice applies at once and the menu stays open; none ticked means
  any, several are one comma-separated parameter (ADR-0051 rule 4). This is the
  list's filter control until the Filter panel (#365) replaces it.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { listHref, toggleListValue, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import ListFilterIcon from "@lucide/svelte/icons/list-filter";
  import { splitListParam } from "@vmb/types";
  import { activeFilters, type ListFilter } from "./FilterChips.svelte";

  let {
    base,
    filters,
    open = $bindable(false),
    label = "Filter",
    class: className = ""
  }: {
    base: MasterListPathname;
    filters: readonly ListFilter[];
    open?: boolean;
    label?: string;
    class?: string;
  } = $props();

  const activeCount = $derived(activeFilters(filters, page.url.searchParams).length);

  // The menu stays open, so a second tick can come before the first navigation has landed:
  // each tick builds on the choices made since the URL last changed, not on the old URL.
  let chosen = $state<Record<string, string | null>>({});
  $effect(() => {
    void page.url.search;
    chosen = {};
  });
  const valueOf = (key: string) => (key in chosen ? chosen[key]! : page.url.searchParams.get(key));

  function toggle(filter: ListFilter, value: string) {
    chosen[filter.key] = toggleListValue(
      valueOf(filter.key),
      value,
      filter.options.map((option) => option.value)
    );
    goto(resolve(listHref(base, page.url.searchParams, { ...chosen })), {
      noScroll: true,
      keepFocus: true
    });
  }
</script>

<DropdownMenu.Root bind:open>
  <!-- the button slot gives it the 44px touch target and the full focus ring -->
  <DropdownMenu.Trigger
    data-slot="button"
    class={cn(buttonVariants({ variant: "outline" }), "relative", className)}
  >
    <ListFilterIcon aria-hidden="true" data-icon="inline-start" />{label}
    {#if activeCount > 0}
      <span class="bg-primary text-primary-foreground rounded-full px-1.5 text-xs tabular-nums"
        >{activeCount}</span
      ><span class="sr-only">active</span>
    {/if}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-56">
    {#each filters as filter, index (filter.key)}
      {@const picked = splitListParam(valueOf(filter.key) ?? "")}
      {#if index > 0}<DropdownMenu.Separator />{/if}
      <DropdownMenu.Group>
        <DropdownMenu.GroupHeading class="flex items-center gap-1.5">
          {#if filter.icon}<filter.icon aria-hidden="true" class="size-3.5" />{/if}{filter.label}
        </DropdownMenu.GroupHeading>
        {#each filter.options as option (option.value)}
          <DropdownMenu.CheckboxItem
            checked={picked.includes(option.value)}
            onCheckedChange={() => toggle(filter, option.value)}
            closeOnSelect={false}>{option.label}</DropdownMenu.CheckboxItem
          >
        {/each}
      </DropdownMenu.Group>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
