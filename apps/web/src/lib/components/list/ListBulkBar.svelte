<!--
  What a list's toolbar becomes while rows are chosen (#305): "3 selected", the
  actions that apply, and Clear, in place of the toolbar and as tall as its
  controls row. The count is a polite status, so a screen reader hears it change as boxes
  are ticked. Put it where `ListToolbar` goes, inside the card.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import XIcon from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";

  let {
    count,
    label,
    onclear,
    children
  }: {
    count: number;
    /** Names the region: "Bulk actions for divisions". */
    label: string;
    onclear: () => void;
    /** The actions that apply, as buttons. */
    children?: Snippet;
  } = $props();
</script>

<div
  role="region"
  aria-label={label}
  data-slot="list-bulk-bar"
  class="border-border bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2"
>
  <p role="status" class="text-sm font-medium tabular-nums">{count} selected</p>
  <div class="ml-auto flex items-center gap-2">
    {@render children?.()}
    <Button type="button" variant="outline" onclick={onclear}>
      <XIcon aria-hidden="true" data-icon="inline-start" />Clear
    </Button>
  </div>
</div>
