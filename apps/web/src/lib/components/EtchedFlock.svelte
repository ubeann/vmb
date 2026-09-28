<!--
  A small engraved flock of seabirds over a low cloud bank, set in the empty
  paper under the brand line so the left column is framed without anything
  crossing the text. Drawn like the other plates (an alpha mask filled with a
  30% `--etching` wash). Shown only on desktops tall enough (56rem) to keep it clear
  of the landscape; it fades in once after the sky. Decorative.
-->
<script lang="ts">
  import flock from "$lib/assets/auth/vmb-flock-1200.webp";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();
</script>

<div
  aria-hidden="true"
  class={cn("etched-flock pointer-events-none select-none", className)}
  style="--flock-image: url({flock})"
></div>

<style>
  .etched-flock {
    display: none;
    /* Width ÷ height of vmb-flock-1200.webp */
    aspect-ratio: 4.037;
    background-color: color-mix(in oklch, var(--etching) 30%, transparent);
    mask-image: var(--flock-image);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
    animation: flock-settle 2400ms cubic-bezier(0.22, 1, 0.36, 1) 1300ms both;
  }

  @media (min-width: 64rem) and (min-height: 56rem) {
    .etched-flock {
      display: block;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .etched-flock {
      animation: none;
    }
  }

  @keyframes flock-settle {
    from {
      opacity: 0;
      translate: -1.5rem 0.5rem;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
</style>
