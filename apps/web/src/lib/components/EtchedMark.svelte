<!--
  A small engraved mark on a signed-out page's sheet (#273): ink drawn through
  a mask and filled with the `--etching` token, so one file serves both colour
  schemes. The box takes the art's own ratio from its width, so the caller
  sets only `class` for the place and the width. It does not move: it shows
  with the step it belongs to, which the sheet already cross-fades, and the
  first field of that step has focus. Decorative.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";

  let {
    art,
    class: className
  }: {
    /** The ink mask's URL and its width ÷ height. */
    art: { image: string; ratio: number };
    class?: string;
  } = $props();
</script>

<div
  aria-hidden="true"
  data-etched-mark
  class={cn("etched-mark bg-etching pointer-events-none select-none", className)}
  style="--mark-image: url({art.image}); --mark-ratio: {art.ratio}"
></div>

<style>
  .etched-mark {
    aspect-ratio: var(--mark-ratio);
    mask-image: var(--mark-image);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
  }
</style>
