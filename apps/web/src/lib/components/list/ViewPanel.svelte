<!--
  The View panel (#366; ADR-0051 rule 6) in place of the Columns menu: the
  columns (the identity column listed but locked, "Always shown"), rows per
  page and, once the card is under 32rem and its rows fold to two lines, Sort
  by and Order instead of the columns. A choice applies at once and the panel
  stays open; a dot on the button says something differs from the default, and
  Reset puts every part back. The sort and page size live in the URL, the
  columns in the browser (`ColumnVisibility`).

  It sits in the list's layer (ADR-0053), so it is the panel by its button, a
  dialog or a bottom sheet by screen size. Put it in `ListToolbar`'s `actions`;
  it finds the card by `data-list-card` to learn when the rows have folded.
-->
<script lang="ts" generics="Id extends string">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@vmb/types";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import Columns3Icon from "@lucide/svelte/icons/columns-3";
  import LockIcon from "@lucide/svelte/icons/lock";
  import Rows3Icon from "@lucide/svelte/icons/rows-3";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import { RadioGroup } from "bits-ui";
  import type { ColumnVisibility } from "./column-visibility.svelte.js";
  import { Layer, LayerBody } from "./layer/index.js";
  import { TOOL_BUTTON, TOOL_LABEL } from "./tool-button.js";
  import {
    foldsAt,
    orderChoices,
    pickField,
    sortChanges,
    viewDiffers,
    type ListSort,
    type SortField
  } from "./view.js";

  let {
    base,
    columns,
    perPage,
    sort,
    defaultSort,
    sortFields
  }: {
    base: MasterListPathname;
    columns: ColumnVisibility<Id>;
    /** The page size the list is showing. */
    perPage: number;
    /** The sort the list is showing. */
    sort: ListSort;
    /** The sort the list has with nothing in the URL. */
    defaultSort: ListSort;
    /** The columns Sort by offers, in order; the first is the default's. */
    sortFields: readonly SortField[];
  } = $props();

  // The panel is portalled, outside the card's container queries, so the card's
  // width is measured for the one thing the panel changes with it (rule 11).
  let cardWidth = $state(0);
  let rem = $state(16);
  function watchCard(node: HTMLElement) {
    const card = node.closest<HTMLElement>("[data-list-card]");
    if (!card) return;
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    cardWidth = card.clientWidth;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) cardWidth = entry.contentRect.width;
    });
    observer.observe(card);
    return () => observer.disconnect();
  }
  const folded = $derived(foldsAt(cardWidth, rem));

  // A pick shows at once; the URL catches up when the list has loaded.
  let pending = $state<{ perPage?: number; sort?: ListSort }>({});
  $effect(() => {
    void page.url.search;
    pending = {};
  });
  const shownPerPage = $derived(pending.perPage ?? perPage);
  const shownSort = $derived(pending.sort ?? sort);
  const field = $derived(sortFields.find((each) => each.sort === shownSort.sort));

  const hideable = $derived(columns.columns.filter((column) => columns.hideable(column.id)));
  const pinned = $derived(columns.columns.filter((column) => !columns.hideable(column.id)));
  const differs = $derived(
    viewDiffers({
      columnsChanged: columns.changed,
      perPage: shownPerPage,
      sort: shownSort,
      defaults: defaultSort,
      folded
    })
  );

  const go = (changes: Record<string, string | number | null>) =>
    goto(resolve(listHref(base, page.url.searchParams, changes)), {
      noScroll: true,
      keepFocus: true
    });

  function pickPerPage(value: string) {
    const size = Number(value);
    pending.perPage = size;
    void go({ perPage: size === DEFAULT_PER_PAGE ? null : size });
  }

  function choose(choice: ListSort) {
    pending.sort = choice;
    void go(sortChanges(choice, defaultSort));
  }

  function reset() {
    columns.reset();
    const sortDiffers = folded && (sort.sort !== defaultSort.sort || sort.dir !== defaultSort.dir);
    if (perPage === DEFAULT_PER_PAGE && !sortDiffers) return;
    pending = { perPage: DEFAULT_PER_PAGE, ...(sortDiffers ? { sort: defaultSort } : {}) };
    void go({ perPage: null, ...(sortDiffers ? { sort: null, dir: null } : {}) });
  }

  const uid = $props.id();
  const row =
    "hover:bg-muted focus-visible:ring-ring flex h-9 w-full items-center gap-2 rounded-(--control-radius) px-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none pointer-coarse:h-11";
  const heading = "text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium";
</script>

<Layer label="View">
  {#snippet trigger({ props })}
    <Button {...props} {@attach watchCard} data-slot="button" variant="outline" class={TOOL_BUTTON}>
      <Settings2Icon aria-hidden="true" data-icon="inline-start" /><span class={TOOL_LABEL}
        >View</span
      >
      {#if differs}
        <span
          aria-hidden="true"
          class="bg-foreground ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
        ></span><span class="sr-only">changed</span>
      {/if}
    </Button>
  {/snippet}

  {#snippet headerAction()}
    {#if differs}
      <Button variant="ghost" size="sm" onclick={reset}>Reset</Button>
    {/if}
  {/snippet}

  <LayerBody>
    {#if folded}
      <section aria-labelledby="{uid}-sort" class="border-border border-b px-4 py-3">
        <h3 id="{uid}-sort" class={heading}>
          <ArrowUpDownIcon aria-hidden="true" class="size-3.5" />Sort by
        </h3>
        <RadioGroup.Root
          value={field?.sort ?? ""}
          onValueChange={(value) => {
            const next = sortFields.find((each) => each.sort === value);
            if (next) choose(pickField(next));
          }}
          aria-labelledby="{uid}-sort"
          class="-mx-2 flex flex-col"
        >
          {#each sortFields as each (each.sort)}
            <RadioGroup.Item value={each.sort}>
              {#snippet child({ props, checked })}
                <button {...props} class={cn(row, "justify-between", checked && "font-medium")}>
                  {each.label}
                  {#if checked}<CheckIcon aria-hidden="true" class="text-primary size-4" />{/if}
                </button>
              {/snippet}
            </RadioGroup.Item>
          {/each}
        </RadioGroup.Root>
      </section>
      {#if field}
        <section aria-labelledby="{uid}-order" class="border-border border-b px-4 py-3">
          <h3 id="{uid}-order" class={heading}>
            <ArrowDownIcon aria-hidden="true" class="size-3.5" />Order
          </h3>
          <RadioGroup.Root
            value={shownSort.dir}
            onValueChange={(value) =>
              choose({ sort: field.sort, dir: value === "desc" ? "desc" : "asc" })}
            aria-labelledby="{uid}-order"
            class="-mx-2 flex flex-col"
          >
            {#each orderChoices(field) as choice (choice.dir)}
              <RadioGroup.Item value={choice.dir}>
                {#snippet child({ props, checked })}
                  <button {...props} class={cn(row, "justify-between", checked && "font-medium")}>
                    {choice.label}
                    {#if checked}<CheckIcon aria-hidden="true" class="text-primary size-4" />{/if}
                  </button>
                {/snippet}
              </RadioGroup.Item>
            {/each}
          </RadioGroup.Root>
        </section>
      {/if}
    {:else}
      <section aria-labelledby="{uid}-columns" class="border-border border-b px-4 py-3">
        <h3 id="{uid}-columns" class={heading}>
          <Columns3Icon aria-hidden="true" class="size-3.5" />Columns
        </h3>
        <div class="-mx-2 flex flex-col">
          {#each pinned as column (column.id)}
            <div class={cn(row, "text-muted-foreground hover:bg-transparent")}>
              <LockIcon aria-hidden="true" class="size-4" />{column.label}
              <span class="ml-auto text-xs">Always shown</span>
            </div>
          {/each}
          {#each hideable as column (column.id)}
            <Label class={cn(row, "cursor-pointer font-normal")}>
              <Checkbox
                checked={columns.visible(column.id)}
                onCheckedChange={(on) => columns.set(column.id, on)}
              />{column.label}
            </Label>
          {/each}
        </div>
      </section>
    {/if}

    <section aria-labelledby="{uid}-rows" class="px-4 py-3">
      <h3 id="{uid}-rows" class={cn(heading, "mb-2")}>
        <Rows3Icon aria-hidden="true" class="size-3.5" />Rows per page
      </h3>
      <RadioGroup.Root
        value={String(shownPerPage)}
        onValueChange={pickPerPage}
        orientation="horizontal"
        aria-labelledby="{uid}-rows"
        class="flex gap-1.5"
      >
        {#each PER_PAGE_OPTIONS as size (size)}
          <RadioGroup.Item value={String(size)}>
            {#snippet child({ props, checked })}
              <button
                {...props}
                class={cn(
                  "focus-visible:ring-ring inline-flex h-8 flex-1 items-center justify-center rounded-(--control-radius) text-sm tabular-nums ring-1 ring-inset focus-visible:ring-2 focus-visible:outline-none pointer-coarse:h-11",
                  checked
                    ? "bg-primary/10 ring-primary/30 text-foreground dark:bg-primary/15 font-medium"
                    : "ring-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>{size}</button
              >
            {/snippet}
          </RadioGroup.Item>
        {/each}
      </RadioGroup.Root>
    </section>
  </LayerBody>
</Layer>
