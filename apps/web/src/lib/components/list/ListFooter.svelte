<!--
  The foot of a list (#301): "Showing x–y of n", the page size, and the
  numbered pages. The count is a status region, so a screen reader hears the
  new range after a search, filter or page change. Page sizes are the shared
  PER_PAGE_OPTIONS; changing one goes back to page 1.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import * as Select from "$lib/components/ui/select/index.js";
  import { listHref, pageWindow, showingRange, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import { PER_PAGE_OPTIONS } from "@vmb/types";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  let {
    base,
    list,
    noun
  }: {
    base: MasterListPathname;
    list: { page: number; perPage: number; total: number };
    noun: string;
  } = $props();

  const uid = $props.id();

  const totalPages = $derived(Math.max(1, Math.ceil(list.total / list.perPage)));
  const range = $derived(showingRange(list));
  // a page past the end (the URL asked for it) still pages back to one that exists
  const current = $derived(Math.min(list.page, totalPages));
  const pages = $derived(pageWindow(current, totalPages));

  const to = (changes: Record<string, string | number | null>) =>
    listHref(base, page.url.searchParams, changes);

  const pageLink =
    "focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-(--control-radius) text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none pointer-coarse:size-11";
</script>

<div class="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
  <p role="status" class="text-muted-foreground tabular-nums">
    {#if list.total === 0}
      No {noun}
    {:else if range.from === 0}
      {list.total} {noun} in all, none on this page
    {:else}
      Showing {range.from}–{range.to} of {list.total}
    {/if}
  </p>

  <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
    <div class="flex items-center gap-2">
      <span id="{uid}-per-page" class="text-muted-foreground">Rows per page</span>
      <Select.Root
        type="single"
        value={String(list.perPage)}
        onValueChange={(value) => goto(resolve(to({ perPage: value })), { noScroll: true })}
      >
        <!-- named by its label and its value, so the visible "25" is part of the name -->
        <Select.Trigger aria-labelledby="{uid}-per-page {uid}-per-page-value" class="w-20"
          ><span id="{uid}-per-page-value">{list.perPage}</span></Select.Trigger
        >
        <Select.Content>
          {#each PER_PAGE_OPTIONS as size (size)}
            <Select.Item value={String(size)}>{size}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    {#if totalPages > 1}
      <nav aria-label="Pages">
        <ul class="flex items-center gap-1">
          <li>
            {#if list.page > 1}
              <a
                class={cn(pageLink, "hover:bg-accent")}
                href={resolve(to({ page: Math.min(list.page - 1, totalPages) }))}
              >
                <ChevronLeftIcon aria-hidden="true" class="size-4" /><span class="sr-only"
                  >Previous page</span
                >
              </a>
            {:else}
              <span class={cn(pageLink, "text-muted-foreground opacity-50")} aria-hidden="true">
                <ChevronLeftIcon class="size-4" />
              </span>
            {/if}
          </li>
          {#each pages as entry, index (entry === "gap" ? `gap-${index}` : entry)}
            <li>
              {#if entry === "gap"}
                <span class={cn(pageLink, "text-muted-foreground")} aria-hidden="true">…</span>
              {:else}
                <a
                  class={cn(
                    pageLink,
                    entry === list.page
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-accent"
                  )}
                  href={resolve(to({ page: entry }))}
                  aria-current={entry === list.page ? "page" : undefined}
                  ><span class="sr-only">Page </span>{entry}</a
                >
              {/if}
            </li>
          {/each}
          <li>
            {#if list.page < totalPages}
              <a
                class={cn(pageLink, "hover:bg-accent")}
                href={resolve(to({ page: list.page + 1 }))}
              >
                <ChevronRightIcon aria-hidden="true" class="size-4" /><span class="sr-only"
                  >Next page</span
                >
              </a>
            {:else}
              <span class={cn(pageLink, "text-muted-foreground opacity-50")} aria-hidden="true">
                <ChevronRightIcon class="size-4" />
              </span>
            {/if}
          </li>
        </ul>
      </nav>
    {/if}
  </div>
</div>
