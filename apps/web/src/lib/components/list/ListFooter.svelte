<!--
  The foot of a list (#301, #363, #366): "Showing x–y of n", "n of m" once a
  search or filter narrows the list (ADR-0051 rule 5), or just "13 divisions"
  when an unfiltered list fits one page, and the pages. The count
  is a status region, so a screen reader hears the new range after a search,
  filter or page change. The page size is the View panel's. Paging hides when
  every row fits on one page; from 640px it is numbered with gaps, under it
  "‹ Previous · Page 5 of 10 · Next ›" under the centred count (rule 10).
-->
<script lang="ts">
  import { resolve } from "$app/paths";
  import { appPath } from "$lib/paths.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    countSummary,
    listHref,
    pageWindow,
    type CountNoun,
    type MasterListPathname
  } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { listPage } from "./list-url.svelte.js";

  // the list's URL, which a record layer over it leaves in place (#302)
  const page = listPage();

  let {
    base,
    list,
    noun,
    outOf = null,
    nameCount = false
  }: {
    base: MasterListPathname;
    list: { page: number; perPage: number; total: number };
    noun: CountNoun;
    /** Rows the view holds before the search and filters; null when none is set or it is unknown. */
    outOf?: number | null;
    /** An unfiltered range names what it counts, as the Trash does ("of 60 deleted divisions"). */
    nameCount?: boolean;
  } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(list.total / list.perPage)));
  // a page past the end (the URL asked for it) still pages back to one that exists
  const current = $derived(Math.min(list.page, totalPages));
  const pages = $derived(pageWindow(current, totalPages));

  const to = (changes: Record<string, string | number | null>) =>
    listHref(base, page.url.searchParams, changes);

  const pageLink =
    "focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-(--control-radius) text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none pointer-coarse:size-11";
</script>

<div class="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
  <p role="status" class="text-muted-foreground tabular-nums max-sm:text-center">
    {countSummary(list, noun, outOf, nameCount)}
  </p>

  {#if totalPages > 1}
    <nav aria-label="Pages" class="max-sm:hidden">
      <ul class="flex items-center gap-1">
        <li>
          {#if list.page > 1}
            <a
              class={cn(pageLink, "hover:bg-muted")}
              href={resolve(appPath(to({ page: Math.min(list.page - 1, totalPages) })))}
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
                    ? "bg-primary/10 ring-primary/30 text-foreground dark:bg-primary/15 font-medium ring-1 ring-inset"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                href={resolve(appPath(to({ page: entry })))}
                aria-current={entry === list.page ? "page" : undefined}
                ><span class="sr-only">Page </span>{entry}</a
              >
            {/if}
          </li>
        {/each}
        <li>
          {#if list.page < totalPages}
            <a
              class={cn(pageLink, "hover:bg-muted")}
              href={resolve(appPath(to({ page: list.page + 1 })))}
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

    <!-- under 640px nobody taps page 7: they page on or back, the buttons one width so the label sits in the middle -->
    <nav aria-label="Pages" class="flex items-center gap-2 sm:hidden">
      <Button
        variant="outline"
        class="h-11 w-28"
        href={resolve(appPath(to({ page: Math.max(1, current - 1) })))}
        disabled={current <= 1}
      >
        <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />Previous
      </Button>
      <p class="flex-1 text-center tabular-nums">
        Page <span class="font-medium">{current}</span> of {totalPages}
      </p>
      <Button
        variant="outline"
        class="h-11 w-28"
        href={resolve(appPath(to({ page: Math.min(totalPages, current + 1) })))}
        disabled={current >= totalPages}
      >
        Next<ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </nav>
  {/if}
</div>
