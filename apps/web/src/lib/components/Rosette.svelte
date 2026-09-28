<!--
  A guilloché rosette, the seal pattern of banknotes and share certificates,
  set faintly behind the auth sheet. Geometry comes from
  docs/design/etched-login/make-rosette.py and is drawn as a mask filled with
  a light wash of `--etching`. It is revealed once by a turning sweep, like a
  rose engine cutting it, and shown finished under reduced motion. Decorative.
-->
<script lang="ts">
  import rosette from "$lib/assets/auth/vmb-rosette.svg";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();
</script>

<div
  aria-hidden="true"
  class={cn("rosette pointer-events-none select-none", className)}
  style="--rosette-image: url({rosette})"
></div>

<style>
  @property --rosette-sweep {
    syntax: "<angle>";
    inherits: false;
    initial-value: 360deg;
  }

  .rosette {
    aspect-ratio: 1;
    background-color: color-mix(in oklch, var(--etching) 28%, transparent);
    mask-image:
      var(--rosette-image),
      conic-gradient(from -90deg, #000 var(--rosette-sweep), transparent var(--rosette-sweep));
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
    mask-composite: intersect;
    animation: rosette-cut 2400ms cubic-bezier(0.65, 0, 0.35, 1) 400ms both;
  }

  @media (prefers-reduced-motion: reduce) {
    .rosette {
      animation: none;
    }
  }

  @keyframes rosette-cut {
    from {
      --rosette-sweep: 0deg;
    }
    to {
      --rosette-sweep: 360deg;
    }
  }
</style>
