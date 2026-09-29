<!--
  A single engraved vignette, such as the error page's scene. Drawn like the
  auth plates: an ink mask filled with the `--etching` token, so one file
  serves both colour schemes. The box keeps the art's ratio and is never
  taller than `--vignette-max-height` (set by the caller), so a wide scene and
  a tall one take the same room. It draws in once, left to right like a press
  roller; reduced motion shows it finished. Decorative.
-->
<script lang="ts">
  import type { ErrorScene } from "$lib/error-page.js";
  import { cn } from "$lib/utils.js";

  let { scene, class: className }: { scene: Pick<ErrorScene, "image" | "ratio">; class?: string } =
    $props();
</script>

<div
  aria-hidden="true"
  class={cn("etched-vignette bg-etching pointer-events-none select-none", className)}
  style="--vignette-image: url({scene.image}); --vignette-ratio: {scene.ratio}"
></div>

<style>
  @property --vignette-reveal {
    syntax: "<percentage>";
    inherits: false;
    initial-value: 115%;
  }

  .etched-vignette {
    aspect-ratio: var(--vignette-ratio);
    width: min(100%, calc(var(--vignette-max-height, 24rem) * var(--vignette-ratio)));
    mask-image:
      linear-gradient(
        to right,
        #000 calc(var(--vignette-reveal) - 15%),
        transparent var(--vignette-reveal)
      ),
      var(--vignette-image);
    mask-size:
      100% 100%,
      100% 100%;
    mask-repeat: no-repeat;
    mask-composite: intersect;
    animation: vignette-reveal 1600ms cubic-bezier(0.65, 0, 0.35, 1) 150ms both;
  }

  @media (prefers-reduced-motion: reduce) {
    .etched-vignette {
      animation: none;
    }
  }

  @keyframes vignette-reveal {
    from {
      --vignette-reveal: 0%;
    }
    to {
      --vignette-reveal: 115%;
    }
  }
</style>
