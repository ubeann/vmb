<!--
  A single engraved vignette, such as the error page's scene. Drawn like the
  auth plates: an ink mask filled with the `--etching` token, so one file
  serves both colour schemes. The box keeps the art's ratio and is never
  taller than `--vignette-max-height` (set by the caller), so a wide scene and
  a tall one take the same room. It draws in once, left to right like a press
  roller. Then its parts move once and rest (#244), each its own mask placed
  from the manifest prepare-etching.py wrote: the lost road's truck pulls away,
  the yard gate swings shut and is locked, the stack of crates topples and one
  crate tumbles after it. Reduced motion shows the finished frame. Decorative.
-->
<script lang="ts">
  import type { ErrorScene } from "$lib/error-page.js";
  import { partMask, partStyle } from "$lib/etched-parts.js";
  import { cn } from "$lib/utils.js";

  let {
    scene,
    class: className
  }: { scene: Pick<ErrorScene, "name" | "image" | "ratio" | "parts">; class?: string } = $props();

  // `no-inline` keeps the small masks as files, out of the JS bundle.
  const urls = import.meta.glob<string>("$lib/assets/errors/vmb-error-*-840.webp", {
    eager: true,
    import: "default",
    query: "?no-inline"
  });
  let parts = $derived(
    Object.entries(scene.parts).map(([name, part]) => ({
      name,
      opaque: part.opaque,
      style: partStyle(part, { small: partMask(urls, `vmb-error-${scene.name}`, name, 840) })
    }))
  );
</script>

<div
  aria-hidden="true"
  class={cn("etched-vignette pointer-events-none relative select-none", className)}
  data-scene={scene.name}
  style="--vignette-image: url({scene.image}); --vignette-ratio: {scene.ratio}"
>
  <div class="plate bg-etching"></div>
  <div class="frame" data-plate>
    {#each parts as part (part.name)}
      <div class="part" class:opaque={part.opaque} data-part={part.name} style={part.style}></div>
    {/each}
  </div>
</div>

<style>
  @property --vignette-reveal {
    syntax: "<percentage>";
    inherits: false;
    initial-value: 115%;
  }

  .etched-vignette {
    aspect-ratio: var(--vignette-ratio);
    width: min(100%, calc(var(--vignette-max-height, 24rem) * var(--vignette-ratio)));
    /* The parts are placed in the plate's percentages and moved in its container units. */
    container-type: inline-size;
    /* A part that leaves, or swings out of the plate, is clipped at its edge. */
    overflow: clip;
  }

  .plate {
    position: absolute;
    inset: 0;
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
    animation: vignette-reveal var(--duration-etch-reveal) var(--easing-reveal)
      var(--delay-etch-plate) both;
  }

  /* The gate's leaves swing about their hinges, so the frame gives them depth. */
  .frame {
    position: absolute;
    inset: 0;
    perspective: 90cqw;
  }

  .part {
    --mask: var(--mask-small);
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--w);
    height: var(--h);
    transform-origin: var(--origin, 50% 50%);
    /* Drawn in ink through the part's mask, which holds the ink in its alpha. */
    background-color: var(--etching);
    mask-image: var(--mask);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
  }

  /*
   * A part in front of the plate hides what is behind it, as the art did
   * before it was cut: a paper backing in the part's silhouette (the mask's
   * alpha), then the ink (its luminance).
   */
  .opaque {
    background-color: transparent;
    mask-image: none;
  }

  .opaque::before,
  .opaque::after {
    content: "";
    position: absolute;
    inset: 0;
    mask-image: var(--mask);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
  }

  .opaque::before {
    background-color: var(--background);
    mask-mode: alpha;
  }

  .opaque::after {
    background-color: var(--etching);
    mask-mode: luminance;
  }

  /*
   * The truck is the road's last visitor: it appears where it stood, waits a
   * moment, then pulls away to the left and out of the plate. It is gone at
   * rest, so its own style hides it and reduced motion shows the empty road.
   */
  [data-part="truck"] {
    opacity: 0;
    animation: truck-drive var(--duration-etch-drive) var(--easing-depart) var(--delay-etch-drive)
      both;
  }

  /* The gate's leaves swing shut from open, each about the hinge at its pillar. */
  [data-part="leaf-left"] {
    --open: 78deg;
    transform-origin: 0 50%;
    animation: leaf-shut var(--duration-etch-part) var(--easing-settle) var(--delay-etch-gate) both;
  }

  [data-part="leaf-right"] {
    --open: -78deg;
    transform-origin: 100% 50%;
    animation: leaf-shut var(--duration-etch-part) var(--easing-settle) var(--delay-etch-gate) both;
  }

  /* Then the chain and padlock drop onto the shut gate. */
  [data-part="lock"] {
    animation: lock-drop var(--duration-icon) var(--easing-standard) var(--delay-etch-lock) both;
  }

  /*
   * The stack stands upright and tips to its lean, overshooting a little before
   * it settles, and a crate tumbles onto the pile after it.
   */
  [data-part="stack"] {
    animation: stack-topple var(--duration-etch-part) var(--easing-arc) var(--delay-etch-topple)
      both;
  }

  [data-part="crate"] {
    animation: crate-tumble var(--duration-etch-part) var(--easing-settle) var(--delay-etch-tumble)
      both;
  }

  @media (prefers-reduced-motion: reduce) {
    .plate,
    .part {
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

  @keyframes truck-drive {
    from {
      opacity: 0;
    }
    12% {
      opacity: 1;
      translate: 0 0;
    }
    30% {
      opacity: 1;
      translate: 0 0;
    }
    to {
      opacity: 0;
      translate: -34cqw 0;
    }
  }

  @keyframes leaf-shut {
    from {
      opacity: 0;
      rotate: y var(--open);
    }
    12% {
      opacity: 1;
    }
  }

  @keyframes lock-drop {
    from {
      opacity: 0;
      translate: 0 -12%;
    }
  }

  @keyframes stack-topple {
    from {
      opacity: 0;
      rotate: -9deg;
    }
    12% {
      opacity: 1;
    }
  }

  @keyframes crate-tumble {
    from {
      opacity: 0;
      rotate: 34deg;
      translate: 3% -110%;
    }
    12% {
      opacity: 1;
    }
  }
</style>
