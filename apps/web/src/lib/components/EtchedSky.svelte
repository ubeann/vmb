<!--
  The engraved sky above the auth pages: clouds, a low sun and seabirds,
  gathered on the right so the headline keeps clear paper. Same technique as
  EtchedScene (an alpha mask filled with `--etching`, here at a lighter wash).
  It fades in and settles once, after the landscape has started; it never
  loops, so there is nothing to pause (WCAG 2.2.2). Decorative.
-->
<script lang="ts">
  import skyLarge from "$lib/assets/auth/vmb-sky-2400.webp";
  import skySmall from "$lib/assets/auth/vmb-sky-1200.webp";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();
</script>

<div
  aria-hidden="true"
  class={cn("etched-sky pointer-events-none select-none", className)}
  style="--sky-small: url({skySmall}); --sky-large: url({skyLarge})"
></div>

<style>
  .etched-sky {
    --sky-image: var(--sky-small);
    background-color: color-mix(in oklch, var(--etching) 45%, transparent);
    /*
     * Clear the masthead band (its tagline ends about 4.5rem down, so the sky
     * starts 2.5rem below that) and the headline column; the art sits right.
     * The full-box gradients come first so no snapped tile edge of the image
     * leaves bare gradient showing (see EtchedScene, #202).
     */
    mask-image:
      linear-gradient(to bottom, transparent 7rem, #000 11rem),
      linear-gradient(to right, transparent 38%, #000 58%), var(--sky-image);
    mask-size:
      100% 100%,
      100% 100%,
      cover;
    /*
     * The art is 2:1 and the box is short and wide, so `cover` crops it: from
     * the top, that cut the low sun in half. 60% keeps the sun (rows 50–79% of
     * the art) and crops the empty paper below and the clouds above it, at
     * every desktop size that crops at all (#219).
     */
    mask-position: right 60%;
    mask-repeat: no-repeat;
    mask-composite: intersect;
    animation: sky-settle 2400ms cubic-bezier(0.22, 1, 0.36, 1) 900ms both;
  }

  @media (min-width: 64rem) {
    .etched-sky {
      --sky-image: var(--sky-large);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .etched-sky {
      animation: none;
    }
  }

  @keyframes sky-settle {
    from {
      opacity: 0;
      translate: 2.5rem 0;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
</style>
