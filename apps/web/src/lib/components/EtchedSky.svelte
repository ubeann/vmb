<!--
  The engraved sky above the auth pages: clouds, a low sun and seabirds,
  gathered on the right so the headline keeps clear paper. Same technique as
  EtchedScene (alpha masks filled with `--etching`, here at a lighter wash).
  It settles once, after the landscape has started: the sky fades in, the
  cloud bank drifts into place, and the seabirds arc in from the right (#243).
  Each moving part is its own mask, placed on the sky from the manifest
  prepare-etching.py writes. Nothing loops, so there is nothing to pause
  (WCAG 2.2.2). Decorative.
-->
<script lang="ts">
  import skyLarge from "$lib/assets/auth/vmb-sky-2400.webp";
  import skySmall from "$lib/assets/auth/vmb-sky-1200.webp";
  import manifest from "$lib/assets/auth/vmb-sky-parts.json";
  import { partMasks, partStyle } from "$lib/etched-parts.js";
  import { cn } from "$lib/utils.js";

  let { class: className }: { class?: string } = $props();

  // `no-inline` keeps the small masks as files, out of the JS bundle.
  const urls = import.meta.glob<string>("$lib/assets/auth/vmb-sky-*-{1200,2400}.webp", {
    eager: true,
    import: "default",
    query: "?no-inline"
  });
  const { parts } = manifest;
  const style = (name: keyof typeof parts) =>
    partStyle(parts[name], partMasks(urls, "vmb-sky", name));
  const clouds = ["cloud-1", "cloud-2"] as const;
  // The nearest bird, lowest and furthest right, arrives first.
  const birds = ["bird-4", "bird-1", "bird-2", "bird-3"] as const;
</script>

<div
  aria-hidden="true"
  class={cn("etched-sky pointer-events-none relative select-none", className)}
>
  <div class="frame" data-plate>
    <div class="art" style="--sky-small: url({skySmall}); --sky-large: url({skyLarge})"></div>
    {#each clouds as name, order (name)}
      <div class="part cloud" data-part={name} style="{style(name)}; --order: {order}"></div>
    {/each}
    {#each birds as name, order (name)}
      <div class="part bird" data-part={name} style="{style(name)}; --order: {order}"></div>
    {/each}
  </div>
</div>

<style>
  .etched-sky {
    /* Width ÷ height of the sky (vmb-sky-*.webp). */
    --sky-ratio: 2;
    --sky-ink: color-mix(in oklch, var(--etching) 45%, transparent);
    container-type: size;
    /*
     * Clear the masthead band (its tagline ends about 4.5rem down, so the sky
     * starts 2.5rem below that) and the headline column; the art sits right.
     */
    mask-image:
      linear-gradient(to bottom, transparent 7rem, #000 11rem),
      linear-gradient(to right, transparent 38%, #000 58%);
    mask-composite: intersect;
  }

  /*
   * The sky covers the box, so it is cropped: from the top, that cut the low
   * sun in half. Anchoring it at the right and 60% down keeps the sun (rows
   * 50–79% of the art) and crops the empty paper below and the clouds above
   * it, at every desktop size that crops at all (#219). This box is that crop
   * (CSS `cover` at `right 60%`), so the parts can be placed in percentages
   * of the art.
   */
  .frame {
    --cover-width: max(100cqw, calc(100cqh * var(--sky-ratio)));
    position: absolute;
    right: 0;
    top: calc((100cqh - var(--cover-width) / var(--sky-ratio)) * 0.6);
    width: var(--cover-width);
    aspect-ratio: var(--sky-ratio);
  }

  .art,
  .part {
    --mask: var(--mask-small);
    background-color: var(--sky-ink);
    mask-image: var(--mask);
    mask-size: 100% 100%;
    mask-repeat: no-repeat;
  }

  .art {
    --mask: var(--sky-small);
    position: absolute;
    inset: 0;
    animation: sky-settle var(--duration-etch-settle) var(--easing-settle) var(--delay-etch-sky)
      both;
  }

  .part {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--w);
    height: var(--h);
  }

  .cloud {
    animation: cloud-drift var(--duration-etch-settle) var(--easing-settle)
      calc(var(--delay-etch-clouds) + var(--order) * var(--stagger-etch)) both;
  }

  /*
   * Each bird glides in from the right and settles, while rising past its
   * place and sinking back: two animations on separate properties, so the
   * path is an arc. It never comes from the left, where the headline is.
   */
  .bird {
    --bird-delay: calc(var(--delay-etch-birds) + var(--order) * var(--stagger-etch));
    animation:
      bird-glide var(--duration-etch-settle) var(--easing-settle) var(--bird-delay) both,
      bird-rise var(--duration-etch-settle) var(--easing-arc) var(--bird-delay) both;
  }

  @media (min-width: 64rem) {
    .art {
      --mask: var(--sky-large);
    }

    .part {
      --mask: var(--mask-large);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .art,
    .cloud,
    .bird {
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

  /* Farther than the sky itself, so the bank drifts across it. */
  @keyframes cloud-drift {
    from {
      opacity: 0;
      translate: 6rem 0;
    }
    40% {
      opacity: 1;
    }
  }

  @keyframes bird-glide {
    from {
      opacity: 0;
      translate: 10rem 0;
    }
    20% {
      opacity: 1;
    }
  }

  @keyframes bird-rise {
    from {
      transform: translateY(3rem);
    }
  }
</style>
