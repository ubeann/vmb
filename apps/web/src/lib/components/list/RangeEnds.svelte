<!--
  The ends of a range being picked, as one From → To control above the
  calendar (ADR-0051 rule 4): each half shows its day with the year, and a tap
  jumps the calendar to that day's month, so a range longer than the month in
  view still shows both ends. The half whose month is in view is lit.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { DateValue } from "@internationalized/date";
  import type { DateRange } from "bits-ui";
  import { formatRange } from "./dates.js";

  let {
    range,
    month,
    onjump
  }: {
    /** The range being picked; either end may still be open. */
    range: DateRange | undefined;
    /** A day in the month the calendar shows. */
    month: DateValue;
    /** Takes the calendar to the month of a day. */
    onjump: (day: DateValue) => void;
  } = $props();

  const sameMonth = (day: DateValue | undefined) =>
    Boolean(day && day.year === month.year && day.month === month.month);
  // with both ends in view, the end is the one lit
  const inView = $derived(sameMonth(range?.end) ? "to" : sameMonth(range?.start) ? "from" : null);
  const day = (value: DateValue) => formatRange({ from: value.toString(), to: value.toString() });
</script>

<div
  class="ring-border flex overflow-hidden rounded-md ring-1 ring-inset"
  role="group"
  aria-label="Range ends"
>
  {#each [{ end: "from", label: "From", value: range?.start, empty: "Pick a start" }, { end: "to", label: "To", value: range?.end, empty: "Pick an end" }] as half, index (half.end)}
    {#if index > 0}<span aria-hidden="true" class="bg-border w-px self-stretch"></span>{/if}
    {@const lit = inView === half.end}
    <button
      type="button"
      data-slot="range-end"
      disabled={!half.value}
      aria-current={lit ? "true" : undefined}
      aria-label={half.value
        ? `${half.label} ${day(half.value)}, show its month`
        : `${half.label}: ${half.empty}`}
      onclick={() => half.value && onjump(half.value)}
      class={cn(
        "min-w-0 flex-1 px-3 py-1.5 text-left pointer-coarse:py-2",
        lit ? "bg-primary/10 dark:bg-primary/15" : "hover:bg-muted disabled:hover:bg-transparent"
      )}
    >
      <span
        class={cn(
          "block text-[0.7rem] leading-tight",
          lit ? "text-primary font-medium" : "text-muted-foreground"
        )}>{half.label}</span
      >
      <span
        class={cn(
          "block truncate text-sm tabular-nums",
          half.value ? "font-medium" : "text-muted-foreground"
        )}>{half.value ? day(half.value) : half.empty}</span
      >
    </button>
  {/each}
</div>
