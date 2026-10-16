<!--
  A colour of one's own, beyond a form's swatches (#302): a square for
  saturation and brightness, a hue slider, and where the browser has one, an
  eyedropper beside the form's hex field. It sits open in the form, under the swatches, rather than over
  it, so it scrolls with the fields and fits a phone. The form's hex field
  stays the one that posts: the picker reports each colour it makes, and
  follows one typed there.

  The square's thumb is a slider for the keyboard: ← → move saturation and
  ↑ ↓ brightness, a step of 1%, or 10% with Shift.
-->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import PipetteIcon from "@lucide/svelte/icons/pipette";
  import { onMount, untrack, type Snippet } from "svelte";
  import { hexToHsv, hsvToHex, type Hsv } from "./color.js";

  type EyeDropper = new () => { open(): Promise<{ sRGBHex: string }> };

  const HEX = /^#[0-9a-fA-F]{6}$/;

  let {
    id,
    value,
    onpick,
    field
  }: {
    id?: string;
    /** The colour the form holds, when it is a whole `#RRGGBB`. */
    value: string | null;
    /** Each colour the picker makes, as `#RRGGBB`. */
    onpick: (hex: string) => void;
    /** The form's own hex field, which sits on the last line beside the eyedropper. */
    field?: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally
  let hsv = $state<Hsv>(hexToHsv(value ?? "#2563EB"));
  let area = $state<HTMLElement | null>(null);
  let thumb = $state<HTMLElement | null>(null);
  let dropper = $state<EyeDropper | null>(null);

  // a colour typed in the hex field, or a swatch, moves the picker; one it made itself is already there
  $effect(() => {
    const hex = value;
    if (!hex || hex === untrack(() => hsvToHex(hsv))) return;
    const next = hexToHsv(hex);
    // a grey has no hue of its own: the slider keeps the one it had
    hsv = next.s === 0 || next.v === 0 ? { ...next, h: untrack(() => hsv.h) } : next;
  });

  // only some browsers can sample the screen (Chromium's EyeDropper); the server can't tell which
  onMount(() => {
    dropper = (window as unknown as { EyeDropper?: EyeDropper }).EyeDropper ?? null;
  });

  // white to the full hue across, fading to black down
  const plane = $derived(
    `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`
  );

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const percent = (n: number) => Math.round(n * 100);

  function pick(next: Hsv) {
    hsv = next;
    onpick(hsvToHex(next));
  }

  function pointAt(event: PointerEvent) {
    if (!area) return;
    const box = area.getBoundingClientRect();
    pick({
      ...hsv,
      s: clamp((event.clientX - box.left) / box.width),
      v: clamp(1 - (event.clientY - box.top) / box.height)
    });
  }

  function press(event: PointerEvent) {
    if (event.button !== 0) return;
    // the thumb keeps focus, so the arrow keys carry on from where the pointer left it
    event.preventDefault();
    thumb?.focus({ preventScroll: true });
    area?.setPointerCapture(event.pointerId);
    pointAt(event);
  }

  function step(event: KeyboardEvent) {
    const by = event.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp(hsv.s - by) },
      ArrowRight: { s: clamp(hsv.s + by) },
      ArrowDown: { v: clamp(hsv.v - by) },
      ArrowUp: { v: clamp(hsv.v + by) }
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    pick({ ...hsv, ...move });
  }

  async function sample() {
    if (!dropper) return;
    try {
      const { sRGBHex } = await new dropper().open();
      if (HEX.test(sRGBHex)) pick(hexToHsv(sRGBHex));
    } catch {
      // Esc closed the eyedropper: the colour stays as it was
    }
  }
</script>

<!-- room around the square for its thumb, which centres on the edge at the extremes -->
<div {id} data-slot="color-picker" class="mt-2 flex flex-col gap-3">
  <!-- the pointer's surface; the thumb inside is the slider the keyboard and screen readers use -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={area}
    class="relative h-36 cursor-crosshair touch-none rounded-lg select-none"
    style:background={plane}
    onpointerdown={press}
    onpointermove={(event) => area?.hasPointerCapture(event.pointerId) && pointAt(event)}
  >
    <div
      bind:this={thumb}
      role="slider"
      tabindex="0"
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent(hsv.s)}
      aria-valuetext="Saturation {percent(hsv.s)}%, brightness {percent(hsv.v)}%"
      class="focus-visible:outline-ring absolute size-4 -translate-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_1px_3px_rgb(0_0_0/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:size-6"
      style:left="{hsv.s * 100}%"
      style:top="{(1 - hsv.v) * 100}%"
      style:background={hsvToHex(hsv)}
      onkeydown={step}
    ></div>
  </div>

  <!-- the hue on its own line, as long as the square above it, for the finest steps -->
  <input
    data-slot="hue"
    type="range"
    min="0"
    max="359"
    step="1"
    aria-label="Hue"
    aria-valuetext="{Math.round(hsv.h)} degrees"
    value={Math.round(hsv.h)}
    oninput={(event) => pick({ ...hsv, h: Number(event.currentTarget.value) })}
    style:--thumb="hsl({hsv.h} 100% 50%)"
    class="hue h-3 w-full cursor-pointer appearance-none rounded-full"
  />

  <!-- the ways to set the colour outright: the caller's field to type it in, and the eyedropper -->
  {#if field || dropper}
    <div class="flex items-center gap-2">
      {@render field?.()}
      {#if dropper}
        <Button
          variant="outline"
          size="icon"
          class="size-8 shrink-0 pointer-coarse:size-11"
          aria-label="Pick a color from the screen"
          title="Pick a color from the screen"
          onclick={sample}
        >
          <PipetteIcon aria-hidden="true" />
        </Button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .hue {
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  }
  .hue:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .hue::-webkit-slider-thumb {
    appearance: none;
    width: 1rem;
    height: 1rem;
    border: 2px solid #fff;
    border-radius: 9999px;
    background: var(--thumb);
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 0.25),
      0 1px 3px rgb(0 0 0 / 0.35);
  }
  .hue::-moz-range-thumb {
    width: 1rem;
    height: 1rem;
    border: 2px solid #fff;
    border-radius: 9999px;
    background: var(--thumb);
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 0.25),
      0 1px 3px rgb(0 0 0 / 0.35);
  }
  @media (pointer: coarse) {
    .hue::-webkit-slider-thumb {
      width: 1.5rem;
      height: 1.5rem;
    }
    .hue::-moz-range-thumb {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
</style>
