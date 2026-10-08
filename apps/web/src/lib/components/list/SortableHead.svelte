<!--
  A column header that sorts the list (#301). The URL holds the sort
  (`sort`/`dir`); the header carries `aria-sort`, so a screen reader says how the
  column is sorted when it enters it, and the link says what a click will do.
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import * as Table from "$lib/components/ui/table/index.js";
  import { sortState, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";

  let {
    base,
    column,
    label,
    current,
    class: className = ""
  }: {
    base: MasterListPathname;
    column: string;
    label: string;
    current: { sort: string; dir: "asc" | "desc" };
    class?: string;
  } = $props();

  const sorting = $derived(sortState(base, page.url.searchParams, current, column));
  const next = $derived(sorting.ariaSort === "ascending" ? "descending" : "ascending");
</script>

<Table.Head scope="col" aria-sort={sorting.ariaSort} class={className}>
  <a
    href={resolve(sorting.href)}
    aria-label="{label}, sort {next}"
    data-sveltekit-noscroll
    data-sveltekit-keepfocus
    class={cn(
      "hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex items-center gap-1 rounded px-1 py-1 focus-visible:ring-2 focus-visible:outline-none pointer-coarse:min-h-11",
      sorting.ariaSort !== "none" && "text-foreground"
    )}
  >
    {label}
    {#if sorting.ariaSort === "ascending"}
      <ArrowUpIcon aria-hidden="true" class="size-3.5" />
    {:else if sorting.ariaSort === "descending"}
      <ArrowDownIcon aria-hidden="true" class="size-3.5" />
    {:else}
      <ChevronsUpDownIcon aria-hidden="true" class="size-3.5 opacity-50" />
    {/if}
  </a>
</Table.Head>
