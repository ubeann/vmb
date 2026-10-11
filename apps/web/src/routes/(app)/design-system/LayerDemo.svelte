<!--
  The list kit's layer (ADR-0053) holding a small filter, as the Filter panel
  will: values tick at the top level, a date filter opens a step, and its
  custom range is a step of its own, or one picker beside the panel where it
  fits. Resize the window across 640px or the room line with days half-picked
  to see the handover keep them. Filters here are local, not in the URL.
-->
<script lang="ts">
  import { Layer, LayerAction, LayerBody, LayerFooter } from "$lib/components/list/layer/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { RangeCalendar } from "$lib/components/ui/range-calendar/index.js";
  import { cn } from "$lib/utils.js";
  import {
    DateFormatter,
    getLocalTimeZone,
    parseDate,
    today,
    type DateValue
  } from "@internationalized/date";
  import CalendarCheckIcon from "@lucide/svelte/icons/calendar-check";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ListFilterIcon from "@lucide/svelte/icons/list-filter";
  import type { DateRange } from "bits-ui";

  const zone = getLocalTimeZone();
  const now = today(zone);

  const STATUSES = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" }
  ];
  const PRESETS = [
    { value: "today", label: "Today", days: 0 },
    { value: "7d", label: "Last 7 days", days: 6 },
    { value: "30d", label: "Last 30 days", days: 29 }
  ];
  // twelve divisions, each last updated some days ago
  const DIVISIONS = [0, 1, 3, 4, 8, 12, 20, 33, 45, 61, 90, 200].map((ago, i) => ({
    active: i % 4 !== 3,
    updated: now.subtract({ days: ago })
  }));

  let statuses = $state<string[]>([]);
  // a preset's value, or a custom range as "start..end"
  let updated = $state<string | null>(null);
  // the range being picked, before Apply
  let draft = $state<DateRange | undefined>();
  let month = $state<DateValue>(now);

  const rangeOf = (value: string | null): [DateValue, DateValue] | null => {
    const preset = PRESETS.find((p) => p.value === value);
    if (preset) return [now.subtract({ days: preset.days }), now];
    const [start, end] = value?.split("..") ?? [];
    return start && end ? [parseDate(start), parseDate(end)] : null;
  };
  const custom = $derived(Boolean(updated && !PRESETS.some((p) => p.value === updated)));
  const shown = $derived.by(() => {
    const range = rangeOf(updated);
    return DIVISIONS.filter(
      (d) =>
        (!statuses.length || statuses.includes(d.active ? "active" : "inactive")) &&
        (!range || (d.updated.compare(range[0]) >= 0 && d.updated.compare(range[1]) <= 0))
    ).length;
  });
  const inUse = $derived(Number(statuses.length > 0) + Number(updated !== null));

  const dayMonth = new DateFormatter("en-GB", { day: "numeric", month: "short" });
  const full = new DateFormatter("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const day = (date: DateValue, format = dayMonth) => format.format(date.toDate(zone));
  // "2 – 5 Jan" this year, "28 Dec 2025 – 5 Jan 2026" across New Year
  function rangeLabel([start, end]: [DateValue, DateValue], long = false) {
    if (long || start.year !== end.year || end.year !== now.year)
      return `${day(start, full)} – ${day(end, full)}`;
    if (start.month === end.month) return `${start.day} – ${day(end)}`;
    return `${day(start)} – ${day(end)}`;
  }
  const describe = $derived(
    custom
      ? rangeLabel(rangeOf(updated)!)
      : (PRESETS.find((p) => p.value === updated)?.label ?? "Any time")
  );
  const picked = $derived(
    draft?.start && draft.end ? ([draft.start, draft.end] as [DateValue, DateValue]) : null
  );

  function startDraft() {
    const range = custom ? rangeOf(updated) : null;
    draft = range ? { start: range[0], end: range[1] } : undefined;
    month = draft?.start ?? now;
  }
  function toggle(value: string, on: boolean) {
    statuses = STATUSES.map((s) => s.value).filter((v) =>
      v === value ? on : statuses.includes(v)
    );
  }
  function apply() {
    if (picked) updated = `${picked[0]}..${picked[1]}`;
  }

  const rowClass =
    "hover:bg-muted flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm pointer-coarse:h-11";
</script>

<div class="bg-card ring-foreground/10 flex w-full items-center gap-3 rounded-xl p-3 ring-1">
  <p class="text-muted-foreground text-sm" aria-live="polite">
    {shown} of {DIVISIONS.length} divisions
  </p>
  <div class="ml-auto">
    <Layer
      label="Filters"
      stepTitle={(path) => (path.at(-1) === "range" ? "Updated: custom range" : "Updated")}
      inside={(step) => (draft?.start ? [step, "range"] : [step])}
      onclose={() => (draft = undefined)}
    >
      {#snippet trigger({ props })}
        <Button {...props} data-slot="button" variant="outline">
          <ListFilterIcon aria-hidden="true" data-icon="inline-start" />Filter
          {#if inUse}<Badge class="h-4 min-w-4 px-1 text-[0.65rem]">{inUse}</Badge>{/if}
        </Button>
      {/snippet}

      {#snippet headerAction()}
        {#if inUse}
          <Button
            variant="ghost"
            size="sm"
            onclick={() => {
              statuses = [];
              updated = null;
            }}>Reset</Button
          >
        {/if}
      {/snippet}

      {#snippet children(layer)}
        <LayerBody>
          <section aria-labelledby="layer-demo-status" class="border-border border-b px-4 py-3">
            <h3 id="layer-demo-status" class="text-muted-foreground mb-2 text-xs font-medium">
              Status
            </h3>
            <div class="flex flex-col gap-1">
              {#each STATUSES as status (status.value)}
                <Label class="flex h-8 items-center gap-2 font-normal pointer-coarse:h-11">
                  <Checkbox
                    checked={statuses.includes(status.value)}
                    onCheckedChange={(on) => toggle(status.value, on)}
                  />{status.label}
                </Label>
              {/each}
            </div>
          </section>
          <section class="px-2 py-1.5">
            <button
              type="button"
              data-slot="filter-date-row"
              class={rowClass}
              onclick={() => {
                startDraft();
                layer.open("updated");
              }}
            >
              Updated
              <span
                class={cn(
                  "ml-auto truncate",
                  updated ? "text-foreground font-medium" : "text-muted-foreground"
                )}>{describe}</span
              >
              <ChevronRightIcon aria-hidden="true" class="text-muted-foreground size-4" />
            </button>
          </section>
        </LayerBody>
        <LayerFooter>
          <LayerAction
            label="Show {shown} {shown === 1 ? 'division' : 'divisions'}"
            icon={ListFilterIcon}
            onclick={layer.close}
          />
        </LayerFooter>
      {/snippet}

      {#snippet step(path, layer)}
        {#if path.at(-1) === "range"}
          {@render calendar("@container flex flex-1 justify-center overflow-y-auto px-4 py-2")}
          <LayerFooter>
            {@render applyAction(() => layer.top())}
          </LayerFooter>
        {:else}
          <LayerBody class="px-2 py-2">
            {@render presets(layer.top)}
            <button
              type="button"
              class={cn(rowClass, custom && "font-medium")}
              onclick={() => layer.open("range")}
            >
              <CheckIcon
                aria-hidden="true"
                class={cn("text-primary size-4", !custom && "invisible")}
              />
              <span class="flex-1 text-left">Custom range</span>
              {#if custom}<span class="text-muted-foreground text-xs font-normal tabular-nums"
                  >{describe}</span
                >{/if}
              <ChevronRightIcon aria-hidden="true" class="text-muted-foreground size-4" />
            </button>
          </LayerBody>
        {/if}
      {/snippet}

      {#snippet beside(_, layer)}
        <div class="border-border bg-muted/40 flex w-60 flex-col gap-0.5 border-r p-2">
          {@render presets(layer.top)}
        </div>
        <div class="flex w-min flex-col">
          {@render calendar("p-3")}
          <LayerFooter class="w-0 min-w-full">
            {@render applyAction(() => layer.top())}
          </LayerFooter>
        </div>
      {/snippet}
    </Layer>
  </div>
</div>

{#snippet presets(done: () => void)}
  <div role="radiogroup" aria-label="Updated, a preset" class="flex flex-col">
    {#each [{ value: null, label: "Any time", days: -1 }, ...PRESETS] as preset (preset.value)}
      {@const on = updated === preset.value}
      <button
        type="button"
        role="radio"
        aria-checked={on}
        class={cn(rowClass, on && "font-medium")}
        onclick={() => {
          updated = preset.value;
          draft = undefined;
          done();
        }}
      >
        <CheckIcon aria-hidden="true" class={cn("text-primary size-4", !on && "invisible")} />
        <span class="flex-1 text-left">{preset.label}</span>
        {#if preset.value}
          <span class="text-muted-foreground text-xs font-normal tabular-nums"
            >{rangeLabel(rangeOf(preset.value)!)}</span
          >
        {/if}
        <span aria-hidden="true" class="w-4 shrink-0"></span>
      </button>
    {/each}
  </div>
{/snippet}

<!-- days are 44px, up to 48px where the sheet is wider and the screen taller than 700px -->
{#snippet calendar(className: string)}
  <div class={className}>
    <div
      class="[--cell-size:clamp(2.75rem,calc(100cqw/7),3rem)] in-data-layer-picker:[--cell-size:--spacing(10)] [@media(max-height:700px)]:[--cell-size:2.75rem]"
    >
      <RangeCalendar
        bind:value={draft}
        bind:placeholder={month}
        maxValue={now}
        weekStartsOn={1}
        locale="en-GB"
        class="bg-transparent p-0 [--cell-size:inherit]"
      />
    </div>
  </div>
{/snippet}

{#snippet applyAction(done: () => void)}
  <LayerAction
    label={picked ? `Apply ${rangeLabel(picked)}` : "Pick a start and an end"}
    full={picked ? `Apply ${rangeLabel(picked, true)}` : undefined}
    icon={CalendarCheckIcon}
    disabled={!picked}
    onclick={() => {
      apply();
      done();
    }}
  />
{/snippet}
