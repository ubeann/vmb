<!--
  The Filter panel (#365; ADR-0051 rule 4), on the kit's layer (ADR-0053): the
  panel by its button from 640px, a dialog or bottom sheet under it.

  A value filter is a list of checkboxes with the rows each would give. A date
  filter is one row showing its value, opening presets with their dates and a
  custom range: beside the panel where the picker fits, in a step of its own
  where it doesn't, the custom range a step of its own again so no step
  scrolls on a phone. A choice applies at once, as a link to the list with the
  parameter changed, and the panel stays open. In the sheet and the dialog a
  footer action names the rows shown and closes it, with Reset beside it; the
  panel has no footer, its Reset a quiet link by the title. Reset clears the
  filters and keeps the search.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { RangeCalendar } from "$lib/components/ui/range-calendar/index.js";
  import {
    listHref,
    nounFor,
    toggleListValue,
    type CountNoun,
    type MasterListPathname
  } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import { parseDate, type DateValue } from "@internationalized/date";
  import CalendarCheckIcon from "@lucide/svelte/icons/calendar-check";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ListFilterIcon from "@lucide/svelte/icons/list-filter";
  import { dateFilterRange, dateFilterValue, splitListParam, type DateRange } from "@vmb/types";
  import type { DateRange as PickedRange } from "bits-ui";
  import {
    describeDateFilter,
    formatApplyRange,
    formatRange,
    formatShortRange,
    isCustomRange,
    PRESETS,
    readerToday
  } from "./dates.js";
  import {
    activeFilters,
    type DateFilter,
    type ListFilter,
    type ValueFilter
  } from "./FilterChips.svelte";
  import { Layer, LayerAction, LayerBody, LayerFooter } from "./layer/index.js";
  import RangeEnds from "./RangeEnds.svelte";
  import { LAYER_RESET, TOOL_BADGE, TOOL_BUTTON, TOOL_LABEL } from "./tool-button.js";
  import { listPage } from "./list-url.svelte.js";

  // the list's URL, which a record layer over it leaves in place (#302)
  const page = listPage();

  let {
    base,
    filters,
    facets = null,
    shown,
    noun,
    class: className = ""
  }: {
    base: MasterListPathname;
    filters: readonly ListFilter[];
    /** For each value filter, how many rows each option would give (the API's `facets`). */
    facets?: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
    /** The rows the list shows now, for the main action; null when the list failed to load. */
    shown: number | null;
    /** What the rows are: "division" and "divisions". */
    noun: CountNoun;
    class?: string;
  } = $props();

  // the panel's picker beside it is a column of presets and a 40px-day calendar
  const PICKER_WIDTH = 576;

  // read again whenever the URL changes, so a tab left open past midnight moves to the new day
  const today = $derived.by(() => {
    void page.url.search;
    return readerToday();
  });
  const maxDay = $derived(parseDate(today));

  let layer = $state<ReturnType<typeof Layer>>();
  const rangeStep = "range";

  // The panel stays open, so a second choice can come before the first navigation has landed:
  // each choice builds on those made since the URL last changed, not on the old URL.
  let chosen = $state<Record<string, string | null>>({});
  $effect(() => {
    void page.url.search;
    chosen = {};
  });
  const valueOf = (key: string) => (key in chosen ? chosen[key]! : page.url.searchParams.get(key));
  const params = $derived.by(() => {
    const next = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(chosen)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return next;
  });
  const inUse = $derived(activeFilters(filters, params, today).length);

  function choose(key: string, value: string | null) {
    chosen[key] = value;
    goto(resolve(listHref(base, page.url.searchParams, { ...chosen })), {
      noScroll: true,
      keepFocus: true
    });
  }

  function toggle(filter: ValueFilter, value: string) {
    choose(
      filter.key,
      toggleListValue(
        valueOf(filter.key),
        value,
        filter.options.map((option) => option.value)
      )
    );
  }

  function reset() {
    for (const filter of filters) chosen[filter.key] = null;
    goto(
      resolve(
        listHref(base, page.url.searchParams, Object.fromEntries(filters.map((f) => [f.key, null])))
      ),
      { noScroll: true, keepFocus: true }
    );
  }

  const dateFilters = $derived(
    new Map(filters.filter((f): f is DateFilter => f.kind === "date").map((f) => [f.key, f]))
  );
  const dateFilter = (key: string) => dateFilters.get(key as DateFilter["key"])!;

  // The custom range being picked, before Apply; the month the calendar shows
  let draft = $state<PickedRange | undefined>();
  let month = $state<DateValue>(parseDate(readerToday()));
  const picked = $derived<DateRange | null>(
    draft?.start && draft.end ? { from: draft.start.toString(), to: draft.end.toString() } : null
  );

  function startDraft(key: string) {
    const value = valueOf(key);
    const range = isCustomRange(value, today) ? dateFilterRange(value ?? "", today) : null;
    draft = range ? { start: parseDate(range.from), end: parseDate(range.to) } : undefined;
    month = draft?.start ?? maxDay;
  }

  function applyRange(key: string, close: () => void) {
    if (!picked) return;
    // a range equal to a preset is kept as the preset, so the link stays relative
    choose(key, dateFilterValue(picked, today));
    draft = undefined;
    close();
  }

  function pickPreset(key: string, value: string | null, close: () => void) {
    choose(key, value);
    draft = undefined;
    close();
  }

  /** Opens the panel, at a date filter's picker when given its key (a chip's click). */
  export function show(key?: string) {
    const date = key !== undefined && dateFilters.has(key as DateFilter["key"]);
    if (date) startDraft(key);
    layer?.openAt(date ? key : undefined);
  }

  const rowClass =
    "hover:bg-muted flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm whitespace-nowrap pointer-coarse:h-11 in-data-[layer-frame=modal]:h-11";
</script>

<Layer
  bind:this={layer}
  label="Filters"
  icon={ListFilterIcon}
  pickerWidth={PICKER_WIDTH}
  stepTitle={(path) =>
    path.at(-1) === rangeStep
      ? `${dateFilter(path[0]!).label}: custom range`
      : dateFilter(path[0]!).label}
  inside={(step) => (draft?.start ? [step, rangeStep] : [step])}
  onclose={() => (draft = undefined)}
>
  {#snippet trigger({ props })}
    <Button
      {...props}
      data-slot="button"
      title="Filter"
      variant="outline"
      class={cn(TOOL_BUTTON, className)}
    >
      <ListFilterIcon aria-hidden="true" data-icon="inline-start" /><span class={TOOL_LABEL}
        >Filter</span
      >
      {#if inUse > 0}
        <span class={TOOL_BADGE}>{inUse}<span class="sr-only">&#32;in use</span></span>
      {/if}
    </Button>
  {/snippet}

  {#snippet headerAction()}
    {#if inUse > 0}
      <button
        type="button"
        data-slot="layer-reset"
        class={cn(LAYER_RESET, "in-data-[layer-frame=modal]:hidden")}
        data-layer-reset
        onclick={reset}>Reset</button
      >
    {/if}
  {/snippet}

  {#snippet children(api)}
    <LayerBody>
      {#each filters as filter (filter.key)}
        {#if filter.kind === "date"}
          {@const value = valueOf(filter.key)}
          <div class="border-border border-b px-2 py-1.5 last:border-b-0">
            <button
              type="button"
              data-slot="filter-date-row"
              aria-expanded={api.beside === filter.key}
              class={cn(rowClass, "aria-expanded:bg-muted")}
              onclick={() => {
                startDraft(filter.key);
                api.open(filter.key);
              }}
            >
              {#if filter.icon}<filter.icon
                  aria-hidden="true"
                  class="text-muted-foreground size-4"
                />{/if}{filter.label}
              <span
                class={cn(
                  "ml-auto truncate",
                  value ? "text-foreground font-medium" : "text-muted-foreground"
                )}>{describeDateFilter(value, today) ?? "Any time"}</span
              >
              <ChevronRightIcon aria-hidden="true" class="text-muted-foreground size-4" />
            </button>
          </div>
        {:else}
          {@const ticked = splitListParam(valueOf(filter.key) ?? "")}
          <section
            aria-labelledby="filter-{filter.key}"
            class="border-border border-b px-4 py-3 last:border-b-0"
          >
            <h3
              id="filter-{filter.key}"
              class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium"
            >
              {#if filter.icon}<filter.icon
                  aria-hidden="true"
                  class="size-3.5"
                />{/if}{filter.label}
            </h3>
            <div class="-mx-2 flex flex-col">
              {#each filter.options as option (option.value)}
                {@const count = facets?.[filter.key]?.[option.value]}
                <Label
                  data-slot="filter-option"
                  class="hover:bg-muted flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 font-normal in-data-[layer-frame=modal]:h-11 pointer-coarse:h-11"
                >
                  <Checkbox
                    variant="kit"
                    checked={ticked.includes(option.value)}
                    onCheckedChange={() => toggle(filter, option.value)}
                  />
                  {option.label}
                  {#if count !== undefined}
                    <span class="text-muted-foreground ml-auto text-xs tabular-nums">{count}</span>
                  {/if}
                </Label>
              {/each}
            </div>
          </section>
        {/if}
      {/each}
    </LayerBody>
    <!-- only closes the layer: the sheet and dialog have it, the panel does not (ADR-0053 rule 4); Reset sits beside it there -->
    <LayerFooter modalOnly>
      {#if inUse > 0}
        <Button type="button" variant="ghost" onclick={reset}>Reset</Button>
      {/if}
      <LayerAction
        label={shown === null ? "Done" : `Show ${shown} ${nounFor(noun, shown)}`}
        icon={ListFilterIcon}
        onclick={api.close}
      />
    </LayerFooter>
  {/snippet}

  {#snippet step(path, api)}
    {@const key = path[0]!}
    {#if path.at(-1) === rangeStep}
      {@render calendar(key, "step")}
      <LayerFooter>{@render applyAction(key, api.top)}</LayerFooter>
    {:else}
      <LayerBody class="px-2 py-2">
        {@render presets(key, api.top)}
        {@const value = valueOf(key)}
        {@const custom = isCustomRange(value, today)}
        <button
          type="button"
          data-slot="layer-row"
          aria-current={custom ? "true" : undefined}
          class={cn(rowClass, custom && "font-medium")}
          onclick={() => api.open(rangeStep)}
        >
          <CheckIcon aria-hidden="true" class={cn("text-primary size-4", !custom && "invisible")} />
          <span class="flex-1 text-left">Custom range</span>
          {#if custom}<span class="text-muted-foreground text-xs font-normal tabular-nums"
              >{describeDateFilter(value, today)}</span
            >{/if}
          <ChevronRightIcon aria-hidden="true" class="text-muted-foreground size-4" />
        </button>
      </LayerBody>
    {/if}
  {/snippet}

  {#snippet beside(key, api)}
    <div class="border-border bg-muted/40 flex min-w-64 flex-col gap-0.5 border-r p-2">
      {@render presets(key, api.top)}
      {#if isCustomRange(valueOf(key), today)}
        <!-- the list always says what is applied, a custom range included; the calendar beside it is the way to change it -->
        {@const range = dateFilterRange(valueOf(key) ?? "", today)!}
        <div
          aria-current="true"
          class={cn(rowClass, "cursor-default font-medium hover:bg-transparent")}
        >
          <CheckIcon aria-hidden="true" class="text-primary size-4" />
          <span class="shrink-0">Custom</span>
          <span
            class="text-muted-foreground ml-auto min-w-0 truncate text-xs font-normal tabular-nums"
            title={formatRange(range)}>{formatShortRange(range, today)}</span
          >
          <span aria-hidden="true" class="w-4 shrink-0"></span>
        </div>
      {/if}
    </div>
    <div class="flex w-min flex-col">
      {@render calendar(key, "beside")}
      <LayerFooter class="w-0 min-w-full">{@render applyAction(key, api.top)}</LayerFooter>
    </div>
  {/snippet}
</Layer>

<!-- Any time and the presets with their dates; a preset applies at once and closes the step -->
{#snippet presets(key: string, close: () => void)}
  {@const value = valueOf(key)}
  <div role="radiogroup" aria-label="{dateFilter(key).label}, a preset" class="flex flex-col">
    {#each [{ value: null, label: "Any time" }, ...PRESETS] as preset (preset.value)}
      {@const on = (value ?? null) === preset.value}
      {@const days = preset.value ? dateFilterRange(preset.value, today) : null}
      <button
        type="button"
        data-slot="layer-row"
        role="radio"
        aria-checked={on}
        class={cn(rowClass, on && "font-medium")}
        onclick={() => pickPreset(key, preset.value, close)}
      >
        <CheckIcon aria-hidden="true" class={cn("text-primary size-4", !on && "invisible")} />
        <span class="flex-1 text-left">{preset.label}</span>
        {#if days}
          <span class="text-muted-foreground text-xs font-normal tabular-nums"
            >{formatShortRange(days, today)}</span
          >
        {/if}
        <span aria-hidden="true" class="w-4 shrink-0"></span>
      </button>
    {/each}
  </div>
{/snippet}

<!--
  The range calendar under its From → To control. In a step it fills the layer, its days 44px
  (up to 48px where the sheet is wider and the screen taller than 700px); beside the panel its days
  are 40px.
-->
{#snippet calendar(key: string, where: "step" | "beside")}
  <div
    class={where === "step"
      ? "@container flex flex-1 justify-center overflow-y-auto px-4 py-2"
      : "p-3"}
  >
    <div
      class={where === "step"
        ? "[--cell-size:clamp(2.75rem,calc(100cqw/7),3rem)] [@media(max-height:700px)]:[--cell-size:2.75rem]"
        : "[--cell-size:--spacing(10)]"}
    >
      <div class="mb-2 w-[calc(var(--cell-size)*7)]">
        <RangeEnds range={draft} {month} onjump={(day) => (month = day)} />
      </div>
      <RangeCalendar
        bind:value={draft}
        bind:placeholder={month}
        maxValue={maxDay}
        weekStartsOn={1}
        locale="en-GB"
        aria-label="{dateFilter(key).label}, custom range"
        class="bg-transparent p-0 [--cell-size:inherit]"
      />
    </div>
  </div>
{/snippet}

{#snippet applyAction(key: string, close: () => void)}
  <LayerAction
    label={picked ? `Apply ${formatApplyRange(picked, today)}` : "Pick a start and an end"}
    full={picked ? `Apply ${formatRange(picked)}` : undefined}
    icon={CalendarCheckIcon}
    disabled={!picked}
    onclick={() => applyRange(key, close)}
  />
{/snippet}
