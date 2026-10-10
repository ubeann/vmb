<!--
  PROTOTYPE (prototype/list-kit): variants B, C and D, every rule from the 2026-10-09 grilling.
  Q1 no Status column, an Inactive pill after the name · Q2 a row click opens the record ·
  Q3 a ⋯ trigger · Q5 All | Trash as a segmented control in the toolbar · Q6 a button per
  filter, "More filters" past the second · Q7 a per-list placeholder · Q8 no description ·
  Q9 a smaller title with the action on its row · Q10 no paging when it all fits ·
  Q11 the description absorbs the spare width · Q13 one control shape · Q14 "n of m · Clear" ·
  Q15 the phone sheet lists the options. `tile` is Q4's question: solid, tint or glyph.
  Round 2 (2026-10-10): Q4 went to tinted; `toolbar` explores the desktop toolbar; the row menu
  takes a vertical ⋮ with Activate/Deactivate; the row hover paints every cell at once.
-->
<script lang="ts">
  // PROTOTYPE: every URL here goes through resolve() inside a helper the rule cannot follow
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import Page from "$lib/components/Page.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import ColumnsMenu from "$lib/components/list/ColumnsMenu.svelte";
  import { ColumnVisibility } from "$lib/components/list/column-visibility.svelte.js";
  import { columnClass } from "$lib/components/list/columns.js";
  import ListFooter from "$lib/components/list/ListFooter.svelte";
  import ListSearch from "$lib/components/list/ListSearch.svelte";
  import SortableHead from "$lib/components/list/SortableHead.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { listHref, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CirclePlusIcon from "@lucide/svelte/icons/circle-plus";
  import Columns3Icon from "@lucide/svelte/icons/columns-3";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import CalendarPlusIcon from "@lucide/svelte/icons/calendar-plus";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import ListFilterIcon from "@lucide/svelte/icons/list-filter";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import XIcon from "@lucide/svelte/icons/x";
  import type { Division } from "@vmb/types";
  import { onMount, type Component } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  type Toolbar = "row" | "filter" | "card" | "pills";
  type Chip = "green" | "outline" | "navy";
  let {
    data,
    tile,
    toolbar = "row",
    chip = "green"
  }: {
    data: PageData;
    tile: "solid" | "tint" | "glyph";
    toolbar?: Toolbar;
    chip?: Chip;
  } = $props();

  const base = "/prototype/list-kit" as MasterListPathname;

  // Round 3: each filter carries an icon, shown on its chip and in the Filter menu
  // Round 4: `any` names the unset choice ("Any status"); `custom` adds a "Custom range…" stub
  type Filter = {
    key: string;
    label: string;
    icon: Component;
    any: string;
    custom?: boolean;
    options: { value: string; label: string }[];
  };
  const DATE_PRESETS = [
    { value: "today", label: "Today" },
    { value: "week", label: "Last 7 days" },
    { value: "month", label: "This month" }
  ];
  const FILTERS: Filter[] = [
    {
      key: "status",
      label: "Status",
      icon: CircleDotIcon,
      any: "Any status",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" }
      ]
    },
    {
      key: "updated",
      label: "Updated",
      icon: CalendarClockIcon,
      any: "Any time",
      options: DATE_PRESETS
    },
    {
      key: "created",
      label: "Created",
      icon: CalendarPlusIcon,
      any: "Any time",
      custom: true,
      options: DATE_PRESETS
    }
  ];
  // Q6: the first two filters get their own button; the rest go behind "More filters"
  const SHOWN = 2;

  const columns = new ColumnVisibility("prototype-divisions-b", [
    { id: "name", label: "Name", hideable: false },
    { id: "code", label: "Code" },
    { id: "description", label: "Description" },
    { id: "updatedAt", label: "Updated" }
  ]);
  onMount(() => columns.restore());

  const params = $derived(page.url.searchParams);
  const inTrash = $derived(data.query.trashed === "only");
  const sort = $derived({ sort: data.query.sort, dir: data.query.dir });
  const valueOf = (key: string) => params.get(key);
  const activeCount = $derived(FILTERS.filter((f) => valueOf(f.key)).length);
  const filtered = $derived(Boolean(data.query.search) || activeCount > 0);
  const of = $derived(inTrash ? data.trashCount : data.allCount);
  const href = (changes: Record<string, string | null>) => resolve(listHref(base, params, changes));
  const clearHref = $derived(
    href({ search: null, ...Object.fromEntries(FILTERS.map((f) => [f.key, null])) })
  );
  const resetFiltersHref = $derived(href(Object.fromEntries(FILTERS.map((f) => [f.key, null]))));
  // a choice in the Filter popover applies at once; the popover stays open for the next one
  const choose = (key: string, value: string | null) =>
    goto(href({ [key]: value }), { noScroll: true, keepFocus: true });
  const fits = $derived(data.divisions.total <= data.divisions.perPage);

  let sheetOpen = $state(false);
  let opened = $state<Division | null>(null);

  // Q2: the whole row opens the record; the name stays a real link for new tabs and no-JS
  function openRow(event: MouseEvent, division: Division) {
    if ((event.target as HTMLElement).closest("a, button, [role='menuitem']")) return;
    opened = division;
  }
  function openName(event: MouseEvent, division: Division) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    opened = division;
  }
  const stub = (what: string) => () => toast.info(`Prototype: ${what}`);

  // Activate/Deactivate flips the row in place, with an undo, standing in for the real mutation
  const flipped = new SvelteSet<string>();
  const isActive = (division: Division) => division.isActive !== flipped.has(division.id);
  function flip(division: Division) {
    const flipTo = () =>
      flipped.has(division.id) ? flipped.delete(division.id) : flipped.add(division.id);
    flipTo();
    toast.success(`${isActive(division) ? "Activated" : "Deactivated"} ${division.name}`, {
      action: { label: "Undo", onClick: flipTo }
    });
  }

  // Round 3: the in-use chip leaves `secondary` (a cool lavender that sits off the warm surfaces).
  // `badge` is the count on the Filter button, which itself stays an outline button.
  const CHIP: Record<
    Chip,
    { chip: string; part: string; icon: string; label: string; seam: string; badge: string }
  > = {
    green: {
      chip: "bg-primary/10 ring-primary/30 text-foreground ring-1 ring-inset dark:bg-primary/15",
      part: "hover:bg-primary/10 aria-expanded:bg-primary/10",
      icon: "text-primary",
      label: "text-muted-foreground",
      seam: "border-primary/25",
      badge: "bg-primary text-primary-foreground"
    },
    outline: {
      chip: "bg-background ring-border text-foreground shadow-xs ring-1 ring-inset dark:bg-input/30",
      part: "hover:bg-muted aria-expanded:bg-muted",
      icon: "text-primary",
      label: "text-muted-foreground",
      seam: "border-border",
      badge: "bg-foreground text-background"
    },
    navy: {
      chip: "bg-foreground text-background",
      part: "hover:bg-background/15 aria-expanded:bg-background/15",
      icon: "text-background/70",
      label: "text-background/70",
      seam: "border-background/20",
      badge: "bg-foreground text-background"
    }
  };
  const look = $derived(CHIP[chip]);

  const chosenOf = (filter: Filter) => filter.options.find((o) => o.value === valueOf(filter.key));
  const VIEWS = $derived([
    { name: "All", trashed: null, current: !inTrash, count: data.views.all },
    { name: "Trash", trashed: "only", current: inTrash, count: data.views.trash }
  ]);

  // The row's own background faded in over 150ms (`transition-colors` on Table.Row) while the
  // pinned cells, painted separately, switched at once: the middle lagged the edges. No fade,
  // and the pinned cells follow every state that paints the row, the open menu included.
  const ROW = "cursor-pointer transition-none hover:bg-muted has-aria-expanded:bg-muted";
  const PINNED_BG = "bg-card [tr:hover>&]:bg-muted [tr:has([aria-expanded=true])>&]:bg-muted";

  const TILE = {
    solid: "text-white",
    tint: "bg-[color-mix(in_oklab,var(--tile)_14%,transparent)] text-(--tile) dark:bg-[color-mix(in_oklab,var(--tile)_30%,transparent)] dark:text-[color-mix(in_oklab,var(--tile)_50%,white)]",
    glyph: "text-(--tile) dark:text-[color-mix(in_oklab,var(--tile)_50%,white)]"
  };
</script>

{#snippet filterButton(filter: Filter)}
  {@const chosen = chosenOf(filter)}
  {#if chosen}
    <!-- a filter in use: one chip, the menu to change it and an × to drop it -->
    <div class={cn("inline-flex h-8 items-stretch overflow-hidden rounded-md text-sm", look.chip)}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class={cn(
            "inline-flex items-center gap-1.5 pr-2 pl-2 font-medium outline-none",
            look.part
          )}
        >
          <filter.icon aria-hidden="true" class={cn("size-4", look.icon)} />
          <span class={cn("font-normal", look.label)}>{filter.label}</span>{chosen.label}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="w-52">
          {@render optionItems(filter)}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <a
        href={href({ [filter.key]: null })}
        data-sveltekit-noscroll
        aria-label="Clear filter {filter.label}"
        class={cn("inline-flex w-7 items-center justify-center border-l", look.part, look.seam)}
        ><XIcon aria-hidden="true" class="size-3.5" /></a
      >
    </div>
  {:else}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "outline" })}>
        {filter.label}<ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="w-52">
        {@render optionItems(filter)}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
{/snippet}

{#snippet countBadge()}
  {#if activeCount}
    <span
      class={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
        look.badge
      )}>{activeCount}<span class="sr-only"> in use</span></span
    >
  {/if}
{/snippet}

{#snippet optionItems(filter: Filter)}
  {#each [{ value: null, label: filter.any }, ...filter.options] as option (option.value)}
    <DropdownMenu.Item>
      {#snippet child({ props })}
        <a {...props} href={href({ [filter.key]: option.value })} data-sveltekit-noscroll>
          <CheckIcon
            aria-hidden="true"
            class={cn("size-4", valueOf(filter.key) !== option.value && "invisible")}
          />{option.label}
        </a>
      {/snippet}
    </DropdownMenu.Item>
  {/each}
{/snippet}

{#snippet segmented()}
  <nav aria-label="Division views" class="bg-muted inline-flex h-8 items-center rounded-lg p-0.5">
    {#each VIEWS as view (view.name)}
      <a
        href={href({ trashed: view.trashed })}
        data-sveltekit-noscroll
        aria-current={view.current ? "page" : undefined}
        class={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium pointer-coarse:h-10",
          view.current
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {view.name}
        {#if view.trashed}
          <span class="text-muted-foreground text-xs tabular-nums">{view.count}</span>
        {/if}
      </a>
    {/each}
  </nav>
{/snippet}

{#snippet search(cls: string)}
  <ListSearch
    {base}
    label="Search divisions"
    placeholder="Search name, code or description"
    class={cls}
  />
{/snippet}

{#snippet statusLine()}
  {#if filtered}
    <p role="status" class="text-muted-foreground hidden text-sm tabular-nums sm:block">
      {data.divisions.total} of {of} divisions ·
      <a
        href={clearHref}
        data-sveltekit-noscroll
        class="text-foreground underline-offset-4 hover:underline">Clear all</a
      >
    </p>
  {/if}
{/snippet}

<!-- C2, C3: one Filter button. Round 4: one popover, a section per filter, no submenus;
     a choice applies at once and the popover stays open -->
{#snippet filterMenu()}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class={cn(buttonVariants({ variant: "outline" }), "max-sm:hidden")}>
      <ListFilterIcon aria-hidden="true" data-icon="inline-start" />Filter{@render countBadge()}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-56">
      {#each FILTERS as filter, index (filter.key)}
        {#if index > 0}<DropdownMenu.Separator />{/if}
        <DropdownMenu.RadioGroup
          value={valueOf(filter.key) ?? ""}
          onValueChange={(value) => choose(filter.key, value || null)}
        >
          <DropdownMenu.GroupHeading class="flex items-center gap-1.5">
            <filter.icon aria-hidden="true" class="size-3.5" />{filter.label}
          </DropdownMenu.GroupHeading>
          {#each [{ value: "", label: filter.any }, ...filter.options] as option (option.value)}
            <DropdownMenu.RadioItem value={option.value} closeOnSelect={false}
              >{option.label}</DropdownMenu.RadioItem
            >
          {/each}
        </DropdownMenu.RadioGroup>
        {#if filter.custom}
          <DropdownMenu.Item onSelect={stub(`a date-range picker for ${filter.label}`)}
            >Custom range…</DropdownMenu.Item
          >
        {/if}
      {/each}
      {#if activeCount}
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => goto(resetFiltersHref, { noScroll: true })}>
          <XIcon aria-hidden="true" />Reset filters
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

<!-- the filters in use, each still a menu to change it and an × to drop it -->
{#snippet chips()}
  {#each FILTERS.filter((f) => valueOf(f.key)) as filter (filter.key)}
    {@render filterButton(filter)}
  {/each}
{/snippet}

<!-- Q15: on a phone, one Filters button; the sheet lists every option -->
{#snippet phoneFilters()}
  <Sheet.Root bind:open={sheetOpen}>
    <Sheet.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" class="sm:hidden">
          <SlidersHorizontalIcon
            aria-hidden="true"
            data-icon="inline-start"
          />Filters{@render countBadge()}
        </Button>
      {/snippet}
    </Sheet.Trigger>
    <Sheet.Content side="bottom" class="rounded-t-xl">
      <Sheet.Header>
        <Sheet.Title>Filters</Sheet.Title>
      </Sheet.Header>
      <div class="flex flex-col gap-4 px-4 pb-6">
        {#each FILTERS as filter (filter.key)}
          <fieldset>
            <legend class="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase"
              >{filter.label}</legend
            >
            {#each [{ value: null, label: filter.any }, ...filter.options] as option (option.value)}
              <a
                href={href({ [filter.key]: option.value })}
                data-sveltekit-noscroll
                aria-current={valueOf(filter.key) === option.value ? "true" : undefined}
                class="hover:bg-muted flex h-11 items-center gap-2 rounded-md px-2 text-sm"
              >
                <CheckIcon
                  aria-hidden="true"
                  class={cn("size-4", valueOf(filter.key) !== option.value && "invisible")}
                />{option.label}
              </a>
            {/each}
          </fieldset>
        {/each}
        {#if filtered}
          <a
            href={clearHref}
            class={buttonVariants({ variant: "outline" })}
            onclick={() => (sheetOpen = false)}
            >Clear all · {data.divisions.total} of {of} divisions</a
          >
        {/if}
      </div>
    </Sheet.Content>
  </Sheet.Root>
{/snippet}

<Page width="default" class="flex flex-col gap-4">
  <!-- Q8, Q9: no description; a smaller title with the action on its row -->
  <header class="flex items-center justify-between gap-3">
    <h1 class="font-display text-2xl font-medium tracking-tight">Divisions</h1>
    <Button onclick={stub("New division")}>
      <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
    </Button>
  </header>

  {#if toolbar === "row"}
    <!-- C1 One row: views, search, a button per filter, More filters, status, columns -->
    <div class="flex flex-wrap items-center gap-2">
      {@render segmented()}
      {@render search("max-sm:order-last max-sm:w-full sm:w-80")}
      <div class="hidden items-center gap-2 sm:flex">
        {#each FILTERS.slice(0, SHOWN) as filter (filter.key)}
          {@render filterButton(filter)}
        {/each}
        {#each FILTERS.slice(SHOWN).filter((f) => valueOf(f.key)) as filter (filter.key)}
          {@render filterButton(filter)}
        {/each}
        {#if FILTERS.slice(SHOWN).some((f) => !valueOf(f.key))}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger class={buttonVariants({ variant: "ghost" })}>
              <ListFilterIcon aria-hidden="true" data-icon="inline-start" />More filters
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" class="w-52">
              {#each FILTERS.slice(SHOWN).filter((f) => !valueOf(f.key)) as filter (filter.key)}
                <DropdownMenu.Group>
                  <DropdownMenu.GroupHeading>{filter.label}</DropdownMenu.GroupHeading>
                  {@render optionItems(filter)}
                </DropdownMenu.Group>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </div>
      <div class="ml-auto flex items-center gap-2">
        {@render statusLine()}
        {@render phoneFilters()}
        <ColumnsMenu {columns} />
      </div>
    </div>
  {:else if toolbar === "filter"}
    <!-- C2 Filter menu: a quiet row at rest; the filters in use drop to a second row -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        {@render search("max-sm:order-last max-sm:w-full sm:w-80")}
        {@render filterMenu()}
        <div class="ml-auto flex items-center gap-2">
          {@render segmented()}
          {@render phoneFilters()}
          <ColumnsMenu {columns} />
        </div>
      </div>
      {#if filtered}
        <div class="hidden flex-wrap items-center gap-2 sm:flex">
          {@render chips()}
          <div class="ml-auto">{@render statusLine()}</div>
        </div>
      {/if}
    </div>
  {:else if toolbar === "pills"}
    <!-- C4 Add-filter pills: views and search above; every filter a dashed pill below -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        {@render segmented()}
        <div class="ml-auto flex items-center gap-2 max-sm:w-full">
          {@render search("max-sm:flex-1 sm:w-80")}
          {@render phoneFilters()}
          <ColumnsMenu {columns} />
        </div>
      </div>
      <div class="hidden flex-wrap items-center gap-2 sm:flex">
        {#each FILTERS as filter (filter.key)}
          {#if chosenOf(filter)}
            {@render filterButton(filter)}
          {:else}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                class={cn(
                  buttonVariants({ variant: "outline" }),
                  "text-muted-foreground border-dashed shadow-none"
                )}
              >
                <CirclePlusIcon aria-hidden="true" data-icon="inline-start" />{filter.label}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" class="w-52"
                >{@render optionItems(filter)}</DropdownMenu.Content
              >
            </DropdownMenu.Root>
          {/if}
        {/each}
        <div class="ml-auto">{@render statusLine()}</div>
      </div>
    </div>
  {/if}

  {@const list = data.divisions}
  <div class="border-border bg-card relative overflow-hidden rounded-lg border">
    {#if toolbar === "card"}
      <!-- C3 In the card: the views are tabs on the table's own top edge, the controls beside them -->
      <div class="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3">
        <nav aria-label="Division views" class="-mb-px flex items-center gap-4 self-stretch">
          {#each VIEWS as view (view.name)}
            <a
              href={href({ trashed: view.trashed })}
              data-sveltekit-noscroll
              aria-current={view.current ? "page" : undefined}
              class={cn(
                "inline-flex h-12 items-center gap-1.5 border-b-2 text-sm font-medium",
                view.current
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {view.name}
              <span class="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums"
                >{view.count}</span
              >
            </a>
          {/each}
        </nav>
        <div class="ml-auto flex items-center gap-2 py-2 max-sm:w-full">
          {@render search("max-sm:flex-1 sm:w-80")}
          {@render filterMenu()}
          {@render phoneFilters()}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="outline" size="icon" aria-label="Columns">
                  <Columns3Icon aria-hidden="true" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-48">
              <DropdownMenu.Group>
                <DropdownMenu.GroupHeading>Show columns</DropdownMenu.GroupHeading>
                {#each columns.columns.filter((c) => columns.hideable(c.id)) as column (column.id)}
                  <DropdownMenu.CheckboxItem
                    checked={columns.visible(column.id)}
                    onCheckedChange={(checked) => columns.set(column.id, checked)}
                    closeOnSelect={false}>{column.label}</DropdownMenu.CheckboxItem
                  >
                {/each}
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
      {#if filtered}
        <div
          class="bg-muted/40 border-border hidden flex-wrap items-center gap-2 border-b px-3 py-2 sm:flex"
        >
          {@render chips()}
          <div class="ml-auto">{@render statusLine()}</div>
        </div>
      {/if}
    {/if}
    {#if list.items.length === 0}
      <EmptyState
        icon={SearchXIcon}
        title="No divisions match"
        description="Try another search, or clear the filters to see every division."
      >
        <a href={clearHref} class={buttonVariants({ variant: "outline" })}
          >Clear search and filters</a
        >
      </EmptyState>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row class="hover:bg-transparent">
            <SortableHead
              {base}
              column="name"
              label="Name"
              current={sort}
              class={cn("bg-card pinned-start sticky left-0 z-10", columnClass("identity"))}
            />
            {#if columns.visible("code")}
              <SortableHead
                {base}
                column="code"
                label="Code"
                current={sort}
                class={columnClass("utility")}
              />
            {/if}
            {#if columns.visible("description")}
              <!-- Q11: free text absorbs the spare width and truncates, down to ~16ch -->
              <Table.Head scope="col" class="w-full max-w-0 min-w-[16ch]">Description</Table.Head>
            {/if}
            {#if columns.visible("updatedAt")}
              <SortableHead
                {base}
                column="updatedAt"
                label={inTrash ? "Deleted" : "Updated"}
                current={sort}
                class={columnClass("utility")}
              />
            {/if}
            <Table.Head
              scope="col"
              class={cn("bg-card pinned-end sticky right-0 z-10", columnClass("utility"))}
              ><span class="sr-only">Actions</span></Table.Head
            >
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each list.items as division (division.id)}
            <Table.Row class={ROW} onclick={(e: MouseEvent) => openRow(e, division)}>
              <Table.Cell
                class={cn(
                  PINNED_BG,
                  "pinned-start sticky left-0 z-10 max-w-72",
                  columnClass("identity")
                )}
              >
                <div class="flex items-center gap-2.5">
                  <span
                    class={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md",
                      TILE[tile]
                    )}
                    style:--tile={division.colorHex}
                    style:background-color={tile === "solid" ? division.colorHex : undefined}
                  >
                    <HeroIcon
                      name={division.iconName}
                      class={tile === "glyph" ? "size-5" : "size-4"}
                    />
                  </span>
                  <a
                    href="#{division.code}"
                    class="truncate font-medium hover:underline"
                    onclick={(e) => openName(e, division)}>{division.name}</a
                  >
                  {#if !isActive(division)}
                    <!-- Q1: only the exception gets a pill -->
                    <StatusPill status="Inactive" class="shrink-0" />
                  {/if}
                </div>
              </Table.Cell>
              {#if columns.visible("code")}
                <Table.Cell class={cn("font-mono text-xs", columnClass("utility"))}
                  >{division.code}</Table.Cell
                >
              {/if}
              {#if columns.visible("description")}
                <Table.Cell class="text-muted-foreground w-full max-w-0 min-w-[16ch]">
                  <span class="block truncate" title={division.description ?? undefined}
                    >{division.description ?? "—"}</span
                  >
                </Table.Cell>
              {/if}
              {#if columns.visible("updatedAt")}
                <Table.Cell class={columnClass("utility")}
                  ><RecordTime
                    iso={inTrash ? division.deletedAt : division.updatedAt}
                  /></Table.Cell
                >
              {/if}
              <Table.Cell
                class={cn(
                  PINNED_BG,
                  "pinned-end sticky right-0 z-10 text-right",
                  columnClass("utility")
                )}
              >
                <!-- Q3, Q16: an always-visible ⋮ with a 44px touch target; it stays lit while its menu is open -->
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        class="data-[state=open]:bg-background data-[state=open]:ring-ring/50 data-[state=open]:ring-[3px] pointer-coarse:size-11"
                        aria-label="Actions for {division.name}"
                      >
                        <EllipsisVerticalIcon aria-hidden="true" />
                      </Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" class="w-48">
                    {#if inTrash}
                      <DropdownMenu.Item onSelect={stub(`Restore ${division.name}`)}
                        >Restore</DropdownMenu.Item
                      >
                    {:else}
                      <DropdownMenu.Group>
                        <DropdownMenu.Item onSelect={stub(`Edit ${division.name}`)}
                          >Edit</DropdownMenu.Item
                        >
                        <DropdownMenu.Item onSelect={() => flip(division)}
                          >{isActive(division) ? "Deactivate" : "Activate"}</DropdownMenu.Item
                        >
                      </DropdownMenu.Group>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        variant="destructive"
                        onSelect={stub(`Delete ${division.name}`)}>Delete…</DropdownMenu.Item
                      >
                    {/if}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </div>

  <!-- Q10: no paging controls when everything fits on the page -->
  {#if fits}
    {#if !filtered && list.total > 0}
      <p class="text-muted-foreground text-sm tabular-nums">{list.total} divisions</p>
    {/if}
  {:else}
    <ListFooter {base} {list} noun={inTrash ? "divisions in the Trash" : "divisions"} />
  {/if}
</Page>

<!-- Q2: stands in for #302's record modal -->
<Dialog.Root open={opened !== null} onOpenChange={(open) => !open && (opened = null)}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{opened?.name}</Dialog.Title>
      <Dialog.Description>
        Prototype: #302's record modal opens here, from a click anywhere on the row.
      </Dialog.Description>
    </Dialog.Header>
  </Dialog.Content>
</Dialog.Root>
