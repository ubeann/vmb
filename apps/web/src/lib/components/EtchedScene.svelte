<!--
  The auth pages' engraved panorama. The artwork is an ink mask (black with
  ink density in alpha, built by docs/design/etched-login/prepare-etching.py)
  filled with the `--etching` token, so one file serves both colour schemes.
  It draws in once, left to right like a press roller. Then its parts move
  once and rest (#243): the trucks roll onto the bridge, the crane lowers a
  container on its ropes, and light crosses the water under the bridge. Each
  part is its own mask, placed on the plate from the manifest the script
  writes, and the plate behind it was filled in, so nothing shows through
  while it moves.
  Reduced motion shows the finished plate immediately. Purely decorative — the
  form never waits on it.
-->
<script lang="ts">
  import etchingLarge from "$lib/assets/auth/vmb-etching-2400.webp";
  import etchingSmall from "$lib/assets/auth/vmb-etching-1200.webp";
  import manifest from "$lib/assets/auth/vmb-etching-parts.json";
  import { partLift, partMasks, partStyle } from "$lib/etched-parts.js";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();

  // `no-inline` keeps the small masks as files, out of the JS bundle.
  const urls = import.meta.glob<string>("$lib/assets/auth/vmb-etching-*-{1200,2400}.webp", {
    eager: true,
    import: "default",
    query: "?no-inline"
  });
  const { parts } = manifest;
  const style = (name: keyof typeof parts) =>
    partStyle(parts[name], partMasks(urls, "vmb-etching", name));
  // The lead truck, on the right, moves off first.
  const trucks = ["truck-3", "truck-2", "truck-1"] as const;
  // The ropes hang from the boom to the container's resting top, and are
  // uncovered down to its top as it lowers: at first, more than their whole
  // length is still above the container.
  const ropesStyle = `${style("ropes")}; --ropes-hidden: ${(partLift(parts.container) / parts.ropes.box[3]!) * 100}%`;
</script>

<div
  aria-hidden="true"
  class={cn("etched-scene pointer-events-none relative w-full select-none", className)}
  style="--etching-small: url({etchingSmall}); --etching-large: url({etchingLarge})"
>
  <div class="plate bg-etching"></div>
  <div class="frame" data-plate>
    <div class="part water" data-part="water" style={style("water")}></div>
    {#each trucks as name, order (name)}
      <div class="part opaque truck" data-part={name} style="{style(name)}; --order: {order}"></div>
    {/each}
    <div class="part ropes" data-part="ropes" style={ropesStyle}></div>
    <div class="part opaque container" data-part="container" style={style("container")}></div>
  </div>
</div>

<style>
  @property --etch-reveal {
    syntax: "<percentage>";
    inherits: false;
    initial-value: 115%;
  }

  @property --sheen {
    syntax: "<percentage>";
    inherits: false;
    initial-value: 130%;
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
    /* The plate's sides bleed off the band, and so must its parts. */
    overflow: clip;
  }

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
  .plate {
    position: absolute;
    inset: 0;
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
    animation: etch-reveal var(--duration-etch-reveal) var(--easing-reveal) var(--delay-etch-plate)
      both;
  }

  /* The plate's own box, where the parts are placed: as tall as the band, centred on it. */
  .frame {
    position: absolute;
    inset-block: 0;
    left: 50%;
    aspect-ratio: var(--plate-ratio);
    translate: -50% 0;
    container-type: inline-size;
  }

  .part {
    --mask: var(--mask-small);
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--w);
    height: var(--h);
  }

  /*
   * A part in front of the plate hides what is behind it, as the art did
   * before it was cut: a paper backing in the part's silhouette (the mask's
   * alpha), then the ink (its luminance).
   */
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

  /* The convoy rolls in from the left, a tenth of the plate, and stops. */
  .truck {
    animation: truck-roll var(--duration-etch-part) var(--easing-settle)
      calc(var(--delay-etch-trucks) + var(--order) * var(--stagger-etch)) both;
  }

  /*
   * The crane lowers the container from its boom onto the yard. The ropes run
   * from the boom to the container's resting top, and are uncovered from the
   * boom down on the same timing, so their ends stay on the container.
   */
  .container {
    animation: container-lower var(--duration-etch-part) var(--easing-settle)
      var(--delay-etch-crane) both;
  }

  .ropes {
    background-color: var(--etching);
    mask-image: var(--mask);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
    animation: ropes-lower var(--duration-etch-part) var(--easing-settle) var(--delay-etch-crane)
      both;
  }

  /*
   * Light crosses the water once: a soft band that strengthens the water's
   * hatching as it passes (its ink at full strength, through the plate's
   * fade), brighter lines on the dark plate and a glinting shimmer on the
   * light one. At rest the band is past the right edge, so nothing is added.
   */
  .water {
    background-color: var(--etching);
    opacity: 0.6;
    mask-image:
      linear-gradient(
        100deg,
        transparent calc(var(--sheen) - 25%),
        #000 var(--sheen),
        transparent calc(var(--sheen) + 25%)
      ),
      var(--mask);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
    mask-composite: intersect;
    animation: water-light var(--duration-etch-reveal) var(--easing-reveal) var(--delay-etch-water)
      both;
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

    .part {
      --mask: var(--mask-large);
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
   * Where the flock sits (from 64rem wide and 56rem tall), the room between it
   * and the plate is known: `--etched-scene-headroom` is the flock's bottom edge
   * plus its 2.5rem clear zone, measured from the top of the viewport (AuthShell
   * sets it per width, since the brand line wraps to fewer lines as it widens).
   * The band grows into that room until its ink spans the viewport, and never
   * past it. Without the variable the extra term is negative and the band keeps
   * the height set above.
   */
  @media (min-width: 64rem) and (min-height: 56rem) {
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
    .plate,
    .truck,
    .container,
    .ropes,
    .water {
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

  @keyframes truck-roll {
    from {
      opacity: 0;
      translate: -10cqw 0;
    }
    30% {
      opacity: 1;
    }
  }

  @keyframes container-lower {
    from {
      opacity: 0;
      translate: var(--from-x) var(--from-y);
    }
    15% {
      opacity: 1;
    }
  }

  @keyframes ropes-lower {
    from {
      opacity: 0;
      clip-path: inset(0 0 var(--ropes-hidden) 0);
    }
    15% {
      opacity: 1;
    }
  }

  @keyframes water-light {
    from {
      --sheen: -30%;
    }
    to {
      --sheen: 130%;
    }
  }
</style>
