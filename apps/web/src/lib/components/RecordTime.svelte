<!--
  A record's timestamp in a list cell (#301): the absolute date and time in the
  reader's timezone, and the relative time ("2 days ago") in a tooltip on hover.
  The server only knows UTC, so the first render says so and the browser
  switches to its own zone once it takes over. The tooltip adds nothing the
  absolute time doesn't already say, so the cell is not a tab stop: a list of
  25 rows would otherwise put 25 extra stops between the toolbar and the footer.
-->
<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { formatAbsolute, formatRelative } from "$lib/dates.js";
  import { onMount } from "svelte";

  let { iso }: { iso: string | null } = $props();

  let timeZone = $state<string | undefined>("UTC");
  onMount(() => {
    timeZone = undefined;
  });

  const absolute = $derived(iso ? formatAbsolute(iso, timeZone) : null);
</script>

{#if iso && absolute}
  <Tooltip.Provider delayDuration={300}>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <time {...props} tabindex="-1" datetime={iso} class="whitespace-nowrap tabular-nums"
            >{absolute}{timeZone ? ` ${timeZone}` : ""}</time
          >
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>{formatRelative(iso)}</Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{:else}
  <span class="text-muted-foreground">—</span>
{/if}
