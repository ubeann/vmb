<!--
  A date range in a popover, as the list kit's date filters will pick one
  (ADR-0051 rule 4). The trigger keeps the button slot, so touch pointers give
  it 44px like every other control.
-->
<script lang="ts">
  import { DateFormatter, getLocalTimeZone } from "@internationalized/date";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { RangeCalendar } from "$lib/components/ui/range-calendar/index.js";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import type { DateRange } from "bits-ui";

  let value = $state<DateRange | undefined>();

  const format = new DateFormatter("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const label = $derived.by(() => {
    const zone = getLocalTimeZone();
    if (!value?.start) return "Any time";
    const start = format.format(value.start.toDate(zone));
    return value.end ? `${start}–${format.format(value.end.toDate(zone))}` : start;
  });
</script>

<Popover.Root>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button {...props} data-slot="button" variant="outline">
        <CalendarIcon aria-hidden="true" data-icon="inline-start" />{label}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content align="start" class="w-auto p-0">
    <RangeCalendar bind:value numberOfMonths={1} />
  </Popover.Content>
</Popover.Root>
