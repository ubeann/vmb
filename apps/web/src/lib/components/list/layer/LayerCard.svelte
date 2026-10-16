<!--
  A record layer's content on a card, raised off the layer's ground (#302):
  the header and the footer sit on the ground around it, so the fields read
  as one surface to work on. The card holds still and its content scrolls
  inside it, so the footer never cuts across the card's edge; a shade at the
  top or bottom edge says there is more that way.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import LayerBody from "./LayerBody.svelte";

  let {
    class: className,
    children
  }: {
    /** For the content's own layout, such as the gap between its parts. */
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div class="flex min-h-0 flex-1 flex-col px-4 pb-1">
  <div
    data-slot="layer-card"
    class="bg-card border-border/70 flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-xs"
  >
    <LayerBody data-slot="layer-card-body" class={cn("flex flex-col p-4", className)}>
      {@render children()}
    </LayerBody>
  </div>
</div>
