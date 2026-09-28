<!--
  The auth pages' engraved panorama. The artwork is an ink mask (black with
  ink density in alpha, built by docs/design/etched-login/prepare-etching.py)
  filled with the `--etching` token, so one file serves both colour schemes.
  It draws in once, left to right like a press roller; reduced motion shows the
  finished plate immediately. Purely decorative — the form never waits on it.
-->
<script lang="ts">
  import etchingLarge from "$lib/assets/auth/vmb-etching-2400.webp";
  import etchingSmall from "$lib/assets/auth/vmb-etching-1200.webp";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();
</script>

<div
  aria-hidden="true"
  class={cn("etched-scene bg-etching pointer-events-none w-full select-none", className)}
  style="--etching-small: url({etchingSmall}); --etching-large: url({etchingLarge})"
></div>

<style>
  @property --etch-reveal {
    syntax: "<percentage>";
    inherits: false;
    initial-value: 115%;
  }

  .etched-scene {
    /* Width ÷ height of the trimmed plate (vmb-etching-*.webp, 4096 × 1106). */
    --plate-ratio: 3.703;
    --etching-image: var(--etching-small);
    height: clamp(7rem, calc(100vw / var(--plate-ratio)), 22vh);
    /*
     * The plate is fitted to the band's height, never cropped vertically: on a
     * band wider than the plate it ends in its own baked-in side fade, on a
     * narrower one it bleeds off both edges.
     *
     * The full-box reveal gradient must be the top layer. Chrome snaps the
     * plate's tile to device pixels, and `intersect` only masks where the top
     * layer draws, so with the plate on top a fractional band edge (e.g. at
     * 1.5× zoom) left a sliver of bare gradient: a faint line (#202).
     */
    mask-image:
      linear-gradient(
        to right,
        #000 calc(var(--etch-reveal) - 15%),
        transparent var(--etch-reveal)
      ),
      var(--etching-image);
    mask-size:
      100% 100%,
      auto 100%;
    mask-position: center bottom;
    mask-repeat: no-repeat;
    mask-composite: intersect;
    animation: etch-reveal 1600ms cubic-bezier(0.65, 0, 0.35, 1) 150ms both;
  }

  @media (min-width: 40rem) {
    .etched-scene {
      height: clamp(9rem, calc(100vw / var(--plate-ratio)), 30vh);
    }
  }

  @media (min-width: 64rem) {
    .etched-scene {
      --etching-image: var(--etching-large);
      /* A reserve (the footer strip below the plate) comes off the height, so the plate's top edge stays put. */
      height: calc(min(calc(100vw / var(--plate-ratio)), 44vh) - var(--etched-scene-reserve, 0px));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .etched-scene {
      animation: none;
    }
  }

  @keyframes etch-reveal {
    from {
      --etch-reveal: 0%;
    }
    to {
      --etch-reveal: 115%;
    }
  }
</style>
