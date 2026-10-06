<!--
  A small engraved mark on a signed-out page's sheet (#273): ink drawn through
  a mask and filled with the `--etching` token, so one file serves both colour
  schemes. The box takes the art's own ratio from its width, so the caller
  sets only `class` for the place and the width. Decorative.

  By default it does not move: it shows with the step it belongs to, which the
  sheet already cross-fades. With `reveal` it is printed once, left to right,
  like the plate's press roller (ADR-0040): feedback for something the user
  just did, such as sending a code, never ambient motion. Reduced motion shows
  it printed.
-->
<script lang="ts">
  import { cn } from "$lib/utils.js";

  let {
    art,
    reveal = false,
    class: className
  }: {
    /** The ink mask's URL and its width ÷ height. */
    art: { image: string; ratio: number };
    /** Print the mark in once as it appears. */
    reveal?: boolean;
    class?: string;
  } = $props();
</script>

<div
  aria-hidden="true"
  data-etched-mark
  class={cn("etched-mark bg-etching pointer-events-none select-none", { reveal }, className)}
  style="--mark-image: url({art.image}); --mark-ratio: {art.ratio}"
></div>

<style>
  @property --mark-reveal {
    syntax: "<percentage>";
    inherits: false;
    initial-value: 115%;
  }

  .etched-mark {
    aspect-ratio: var(--mark-ratio);
    mask-image: var(--mark-image);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
  }

  /* The plate's reveal (EtchedScene) at the mark's size: a soft edge sweeps the ink in. */
  .etched-mark.reveal {
    mask-image:
      linear-gradient(
        to right,
        #000 calc(var(--mark-reveal) - 15%),
        transparent var(--mark-reveal)
      ),
      var(--mark-image);
    mask-composite: intersect;
    animation: mark-print var(--duration-etch-print) var(--easing-reveal) both;
  }

  @keyframes mark-print {
    from {
      --mark-reveal: 0%;
    }
    to {
      --mark-reveal: 115%;
    }
  }
</style>
