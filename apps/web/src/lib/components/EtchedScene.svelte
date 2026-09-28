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
    --etching-image: var(--etching-small);
    height: clamp(8rem, 22vh, 12rem);
    mask-image:
      var(--etching-image), linear-gradient(to right, transparent, #000 7%, #000 93%, transparent),
      linear-gradient(to right, #000 calc(var(--etch-reveal) - 15%), transparent var(--etch-reveal));
    mask-size:
      cover,
      100% 100%,
      100% 100%;
    mask-position: center bottom;
    mask-repeat: no-repeat;
    mask-composite: intersect;
    animation: etch-reveal 1600ms cubic-bezier(0.65, 0, 0.35, 1) 150ms both;
  }

  @media (min-width: 40rem) {
    .etched-scene {
      height: clamp(9rem, 30vh, 20rem);
    }
  }

  @media (min-width: 64rem) {
    .etched-scene {
      --etching-image: var(--etching-large);
      height: clamp(9rem, 36vh, 26rem);
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
