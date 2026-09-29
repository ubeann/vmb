<!--
  Frame for the signed-out pages (login, activate): the VMB masthead and brand
  line on paper, the page's form on a ruled sheet, and the engraved panorama
  fading into a footer strip at the foot of the viewport. The sheet stays
  usable before, during and without the artwork.
-->
<script lang="ts">
  import EtchedFlock from "$lib/components/EtchedFlock.svelte";
  import EtchedScene from "$lib/components/EtchedScene.svelte";
  import EtchedSky from "$lib/components/EtchedSky.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import type { Snippet } from "svelte";

  let {
    heading,
    description,
    children,
    footer
  }: {
    heading: string;
    description?: Snippet;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<div class="relative isolate flex min-h-dvh flex-col overflow-x-clip">
  <EtchedSky class="absolute inset-x-0 top-0 -z-10 hidden h-[clamp(16rem,55vh,36rem)] lg:block" />

  <SiteHeader />

  <main
    class="relative z-10 mx-auto grid w-full max-w-7xl flex-1 content-start gap-8 px-6 pt-8 pb-6 sm:px-10 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16 lg:px-16 lg:pt-16"
  >
    <div class="relative max-w-xl self-start lg:pt-4">
      <p
        class="font-display text-[2rem] leading-[1.05] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl"
      >
        Every crate, container and receipt, on record.
      </p>
      <p class="text-muted-foreground mt-4 hidden max-w-md text-base text-pretty sm:block lg:mt-6">
        Warehouse items, trucking orders and division expenses, kept in one place for the people who
        run them.
      </p>
      <EtchedFlock class="absolute top-full left-0 mt-10 w-[26rem]" />
    </div>

    <div class="relative w-full lg:justify-self-end">
      <section
        aria-labelledby="auth-heading"
        class="bg-card text-card-foreground w-full rounded-md border p-6 shadow-[0_0_0_5px_var(--card),0_0_0_6px_var(--border),0_24px_48px_-32px_color-mix(in_oklch,var(--etching)_40%,transparent)] sm:p-8"
      >
        <h1 id="auth-heading" class="font-display text-3xl font-medium tracking-tight">
          {heading}
        </h1>
        {#if description}
          <p class="text-muted-foreground mt-2 text-sm text-pretty">{@render description()}</p>
        {/if}

        <div class="mt-6">{@render children()}</div>

        {#if footer}
          <div class="border-border text-muted-foreground mt-6 border-t pt-4 text-sm">
            {@render footer()}
          </div>
        {/if}
      </section>
    </div>
  </main>

  <!-- The plate's bottom fades into the paper; the strip's top padding is the clear zone below the plate's last visible ink. The reserve fits 24px links, or 44px on touch. The headroom is the flock's bottom edge plus its 2.5rem clear zone, and it lets the plate grow into the room above it. The flock sits at 655px below 66rem wide (the brand line wraps to four lines), 568px to 72.5rem (three lines) and 505px beyond (two); the steps sit a little late so a slow wrap never hits the flock. Revisit them when the brand line or flock moves. -->
  <div
    class="relative lg:[--etched-scene-headroom:695px] lg:[--etched-scene-reserve:3.25rem] min-[66.5rem]:[--etched-scene-headroom:608px] min-[73rem]:[--etched-scene-headroom:545px] lg:pointer-coarse:[--etched-scene-reserve:4.25rem]"
  >
    <EtchedScene class="-mt-6 lg:absolute lg:inset-x-0 lg:bottom-full lg:mt-0" />

    <SiteFooter class="lg:min-h-(--etched-scene-reserve) lg:pt-5 lg:pb-0" />
  </div>
</div>
