<!--
  A layer's footer (ADR-0053 rule 4): its main action fills the row
  (LayerAction), and any other button is at least 80px wide.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";

  let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<div
  class={cn(
    "border-border flex shrink-0 items-center gap-2 border-t p-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] in-data-[layer-frame=modal]:p-4 in-data-[layer-frame=modal]:pb-[max(--spacing(4),env(safe-area-inset-bottom))] [&_[data-slot=button]]:min-w-20",
    className
  )}
>
  {@render children()}
</div>
