<!--
  A record's timestamp in a list cell (#301): the absolute date and time in the
  reader's timezone, and the relative time ("2 days ago") in a tooltip on hover.
  The server only knows UTC, so the first render says so and the browser
  switches to its own zone once it takes over. The tooltip adds nothing the
  absolute time doesn't already say, so the cell is not a tab stop: a list of
  25 rows would otherwise put 25 extra stops between the toolbar and the footer.
  `day` is for a line too short for the time (a row folded to two lines): it
  shows the day alone and the tooltip gives the full time.
-->
<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { formatAbsolute, formatDay, formatRelative } from "$lib/dates.js";
  import { onMount } from "svelte";

  let { iso, day = false }: { iso: string | null; day?: boolean } = $props();

  const EMPTY = "—";

  let timeZone = $state<string | undefined>("UTC");
  onMount(() => {
    timeZone = undefined;
  });

  // read when the tooltip opens, so a page left open still says how long ago
  let now = $state(new Date());

  const absolute = $derived(iso ? formatAbsolute(iso, timeZone) : null);
  const shown = $derived(iso && day ? formatDay(iso, timeZone) : absolute);
</script>

{#if iso && absolute}
  <Tooltip.Provider delayDuration={300}>
    <Tooltip.Root onOpenChange={(open) => open && (now = new Date())}>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <time {...props} tabindex="-1" datetime={iso} class="whitespace-nowrap"
            >{shown}{timeZone && !day ? ` ${timeZone}` : ""}</time
          >
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>{day ? `${absolute} · ` : ""}{formatRelative(iso, now)}</Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{:else}
  <span class="text-muted-foreground">{EMPTY}</span>
{/if}
