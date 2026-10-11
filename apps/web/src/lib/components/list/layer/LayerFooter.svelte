<!--
  A layer's footer (ADR-0053 rule 4): its main action fills the row
  (LayerAction), and any other button is at least 80px wide.

  `modalOnly` is for a footer whose action only closes the layer ("Show 12
  divisions", "Done"): it shows in the sheet and the dialog, where nothing
  else closes the layer within reach, and not on the panel, where a click
  outside, Esc or the layer's button does. An action that applies something
  (Apply a range) keeps its footer in every frame.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";

  let {
    class: className,
    modalOnly = false,
    children
  }: {
    class?: string;
    /** Hide the footer on the panel (from 640px): its action only closes the layer. */
    modalOnly?: boolean;
    children: Snippet;
  } = $props();
</script>

<div
  class={cn(
    "border-border flex shrink-0 items-center gap-2 border-t p-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] in-data-[layer-frame=modal]:p-4 in-data-[layer-frame=modal]:pb-[max(--spacing(4),env(safe-area-inset-bottom))] [&_[data-slot=button]]:min-w-20",
    modalOnly && "in-data-[layer-frame=panel]:hidden",
    className
  )}
>
  {@render children()}
</div>
