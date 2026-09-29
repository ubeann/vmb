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
    /*
     * Width ÷ height of the plate (vmb-etching-*.webp), of the art inside its
     * padding, and of the ink itself (the art minus its faded edges).
     */
    --plate-ratio: 5;
    --plate-core-ratio: 4;
    --plate-ink-ratio: 3.85;
    --etching-image: var(--etching-small);
    height: clamp(7rem, calc(100vw / var(--plate-core-ratio)), 22vh);
    /*
     * The plate is fitted to the band's height, never cropped vertically. Its
     * sparse sides bleed off the viewport; the band stays short enough that
     * the middle, where the scene is, always fits the width.
     *
     * The full-box reveal gradient must sit above the plate. Chrome snaps the
     * plate's tile to device pixels, and `intersect` only masks where the top
     * layer draws, so with the plate on top a fractional band edge (e.g. at
     * 1.5× zoom) left a sliver of bare gradient: a faint line (#202). The
     * plate's bottom fades into the paper in the art itself (#219).
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
      height: clamp(9rem, calc(100vw / var(--plate-core-ratio)), 30vh);
    }
  }

  @media (min-width: 64rem) {
    .etched-scene {
      --etching-image: var(--etching-large);
      /*
       * The reserve (the footer strip below the plate) comes off the height,
       * so the plate's top edge stays clear of the brand line and flock; the
       * band never gets narrower than the viewport, so no end shows.
       */
      height: clamp(
        calc(100vw / var(--plate-ratio)),
        calc(min(calc(100vw / var(--plate-core-ratio)), 44vh) - var(--etched-scene-reserve, 0px)),
        calc(100vw / var(--plate-core-ratio))
      );
    }
  }

  /* Tall screens have room above the plate: it grows toward the cap and bleeds off the sides. */
  @media (min-width: 64rem) and (min-height: 68rem) {
    .etched-scene {
      height: clamp(
        calc(100vw / var(--plate-ratio)),
        calc(44vh - var(--etched-scene-reserve, 0px)),
        calc(100vw / var(--plate-core-ratio))
      );
    }
  }

  /*
   * Where the flock sits (from 80rem wide and 56rem tall), the room between it
   * and the plate is known: `--etched-scene-headroom` is the flock's bottom edge
   * plus its 2.5rem clear zone, measured from the top of the viewport. The band
   * grows into that room until its ink spans the viewport, and never past it.
   * Without the variable the extra term is negative and the band keeps the
   * height set above.
   */
  @media (min-width: 80rem) and (min-height: 56rem) {
    .etched-scene {
      height: clamp(
        calc(100vw / var(--plate-ratio)),
        max(
          calc(min(calc(100vw / var(--plate-core-ratio)), 44vh) - var(--etched-scene-reserve, 0px)),
          min(
            calc(100vw / var(--plate-ink-ratio)),
            calc(100vh - var(--etched-scene-reserve, 0px) - var(--etched-scene-headroom, 100vh))
          )
        ),
        calc(100vw / var(--plate-ink-ratio))
      );
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
